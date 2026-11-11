import { useNewSaleModalStore } from "../../lib/new-sale-store";
import { useEffect, useMemo, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { AlertTriangle, Check, ChevronLeft, Package, Plus, Search, Store, Trash2, UserRound, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
import { TextField } from "../ui/TextField";
import { SegmentedControl } from "../ui/SegmentedControl";
import { BillActions } from "../bills/BillActions";
import { listCustomers, createCustomer, type CustomerListItem } from "../../lib/customers-api";
import { listProducts, type Product } from "../../lib/products-api";
import { getStockLevels } from "../../lib/stock-api";
import { SerialPicker } from "./SerialPicker";
import { getProfile } from "../../lib/auth-api";
import {
  getCustomerPendingItems,
  createBill,
  recordPayment,
  type BillType,
  type CreateBillInput,
  type CreditLimitDetails,
  type Invoice,
  type PaymentMethod,
  type StockShortage,
} from "../../lib/invoices-api";
import { ApiError } from "../../lib/api";
import { errorMessage } from "../../lib/api-errors";
import { showError } from "../../lib/toast";
import { formatCurrency, formatMoney, formatQty } from "../../lib/format";
import i18n from "../../lib/i18n";

const newCustomerSchema = z.object({
  name: z.string().min(1, i18n.t("sales.newSaleModal.nameRequired")),
  phone: z.string().optional(),
});
type NewCustomerValues = z.infer<typeof newCustomerSchema>;

interface DraftItem {
  key: string;
  orderId?: string;
  productId?: string;
  productName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  discountPercent: number;
  gstPercent: number;
  isNew: boolean;
  /** IMEI / serial numbers, for serial-tracked items (quantity = how many). */
  serials: string[];
}

let keySeq = 0;
function nextKey() {
  keySeq += 1;
  return `bill-item-${keySeq}`;
}

const paymentMethods: { value: PaymentMethod; labelKey: string }[] = [
  { value: "cash", labelKey: "cash" },
  { value: "upi", labelKey: "upi" },
  { value: "bank_transfer", labelKey: "bank" },
  { value: "cheque", labelKey: "cheque" },
];

type Step = "customer" | "items" | "payment" | "done";
/** "walk-in" = counter sale with no name; otherwise a customer id. */
type Party = { kind: "walk-in" } | { kind: "customer"; id: string } | null;

type Blocked =
  | { kind: "stock"; shortages: StockShortage[] }
  | { kind: "credit"; details: CreditLimitDetails }
  | null;

const round2 = (n: number) => Math.round(n * 100) / 100;

function lineAmounts(item: DraftItem, billType: BillType) {
  const gross = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
  const taxable = round2(gross * (1 - Math.min(100, Math.max(0, item.discountPercent || 0)) / 100));
  const tax = billType === "gst" ? round2((taxable * (item.gstPercent || 0)) / 100) : 0;
  return { gross, taxable, tax, total: round2(taxable + tax) };
}

export function NewSaleModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>("customer");
  const [party, setParty] = useState<Party>(null);
  const [customerQuery, setCustomerQuery] = useState("");
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);

  const [items, setItems] = useState<DraftItem[]>([]);
  const [productQuery, setProductQuery] = useState("");
  const [billType, setBillType] = useState<BillType>("record");
  const [blocked, setBlocked] = useState<Blocked>(null);
  const [overrides, setOverrides] = useState({ stock: false, credit: false });
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [amount, setAmount] = useState("");
  const [counterMethod, setCounterMethod] = useState<"cash" | "upi" | "bank_transfer">("cash");
  const productInputRef = useRef<HTMLInputElement>(null);

  const customerId = party?.kind === "customer" ? party.id : null;

  const {
    register: registerNewCustomer,
    handleSubmit: handleNewCustomerSubmit,
    reset: resetNewCustomerForm,
    setValue: setNewCustomerValue,
    formState: { errors: newCustomerErrors },
  } = useForm<NewCustomerValues>({
    resolver: zodResolver(newCustomerSchema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: { name: "", phone: "" },
  });

  const allCustomersQuery = useQuery({ queryKey: ["customers", "all"], queryFn: () => listCustomers(), enabled: open });
  const productsQuery = useQuery({ queryKey: ["products"], queryFn: () => listProducts(), enabled: open });
  const stockQuery = useQuery({ queryKey: ["stock-levels"], queryFn: getStockLevels, enabled: open });
  const profileQuery = useQuery({ queryKey: ["profile"], queryFn: getProfile, enabled: open, staleTime: 60_000 });

  const customers = useMemo(() => (allCustomersQuery.data ?? []).filter((c) => !c.isWalkIn), [allCustomersQuery.data]);
  const selectedCustomer = customers.find((c) => c._id === customerId) ?? null;
  const filteredCustomers = customers.filter((c) => {
    const q = customerQuery.trim().toLowerCase();
    return !q || c.name.toLowerCase().includes(q) || (c.phone ?? "").includes(q);
  });

  const stockOf = (productId?: string) => (productId ? (stockQuery.data?.[productId]?.total ?? 0) : undefined);
  /** Quantity in the item's base unit (2 box × 24 = 48 pcs). */
  const baseQtyOf = (item: DraftItem) => {
    const product = item.productId ? productById.get(item.productId) : undefined;
    const qty = Number(item.quantity) || 0;
    if (product?.altUnit && item.unit === product.altUnit.name && item.unit !== product.unit) return qty * product.altUnit.factor;
    return qty;
  };
  const productById = useMemo(() => new Map((productsQuery.data ?? []).map((p) => [p._id, p])), [productsQuery.data]);
  const sellable = useMemo(() => (productsQuery.data ?? []).filter((p) => p.isActive && !p.isRawMaterial), [productsQuery.data]);
  const productMatches = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    if (!q) return [];
    return sellable
      .filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || (p.barcode ?? "").toLowerCase() === q)
      .slice(0, 8);
  }, [productQuery, sellable]);

  const pendingItemsQuery = useQuery({
    queryKey: ["invoices", "pending-items", customerId],
    queryFn: () => getCustomerPendingItems(customerId!),
    enabled: Boolean(customerId) && step === "items",
  });

  useEffect(() => {
    if (!pendingItemsQuery.data) return;
    setItems(
      pendingItemsQuery.data.items.map((i) => ({
        key: nextKey(),
        orderId: i.orderId,
        productId: i.productId,
        productName: i.productName,
        quantity: i.quantity,
        unit: i.unit,
        unitPrice: i.unitPrice,
        discountPercent: 0,
        gstPercent: productById.get(i.productId)?.gstPercent ?? 0,
        isNew: false,
        serials: [],
      }))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingItemsQuery.data]);

  const createCustomerMutation = useMutation({
    mutationFn: createCustomer,
    onSuccess: (customer) => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setParty({ kind: "customer", id: customer._id });
      setShowNewCustomerForm(false);
      resetNewCustomerForm({ name: "", phone: "" });
      setStep("items");
    },
    onError: (err) => showError(err instanceof ApiError ? errorMessage(err, t) : t("sales.newSaleModal.couldNotAddCustomer")),
  });

  const createBillMutation = useMutation({
    mutationFn: createBill,
    onSuccess: (inv) => {
      setInvoice(inv);
      setBlocked(null);
      // Counter sales are almost always paid on the spot; credit customers often aren't.
      setAmount(party?.kind === "walk-in" ? String(inv.totalAmount) : "");
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["stock-levels"] });
      queryClient.invalidateQueries({ queryKey: ["stock-level"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setStep(inv.totalAmount > 0 && inv.paymentStatus !== "paid" ? "payment" : "done");
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 409 && err.code === "INSUFFICIENT_STOCK") {
        const details = err.details as { shortages?: StockShortage[] } | undefined;
        setBlocked({ kind: "stock", shortages: details?.shortages ?? [] });
        return;
      }
      if (err instanceof ApiError && err.status === 409 && err.code === "CREDIT_LIMIT") {
        setBlocked({ kind: "credit", details: err.details as CreditLimitDetails });
        return;
      }
      showError(err instanceof ApiError ? errorMessage(err, t) : t("sales.newSaleModal.couldNotGenerateBill"));
    },
  });

  const paymentMutation = useMutation({
    mutationFn: ({ invoiceId, amount, method }: { invoiceId: string; amount: number; method: PaymentMethod }) =>
      recordPayment(invoiceId, { amount, method }),
    onSuccess: (inv) => {
      setInvoice(inv);
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setStep("done");
    },
    onError: (err) => showError(err instanceof ApiError ? errorMessage(err, t) : t("sales.newSaleModal.couldNotRecordPayment")),
  });

  // Opened for a specific customer (e.g. "Make bill" on an order): skip choosing
  // the customer; their unbilled order items load into the bill automatically.
  const presetCustomerId = useNewSaleModalStore((state) => state.presetCustomerId);
  useEffect(() => {
    if (!open || !presetCustomerId) return;
    setParty({ kind: "customer", id: presetCustomerId });
    setStep("items");
  }, [open, presetCustomerId]);

  const resetAll = () => {
    setStep("customer");
    setParty(null);
    setCustomerQuery("");
    setShowNewCustomerForm(false);
    resetNewCustomerForm({ name: "", phone: "" });
    setItems([]);
    setProductQuery("");
    setBillType("record");
    setBlocked(null);
    setOverrides({ stock: false, credit: false });
    setInvoice(null);
    setMethod("cash");
    setAmount("");
    setCounterMethod("cash");
  };

  useEffect(() => {
    if (!open) resetAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Any edit to the bill means earlier warnings may no longer apply.
  const touch = () => {
    setBlocked(null);
    setOverrides({ stock: false, credit: false });
  };

  if (!open) return null;

  const updateItem = (key: string, patch: Partial<DraftItem>) => {
    touch();
    setItems((current) => current.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  };
  const removeItem = (key: string) => {
    touch();
    setItems((current) => current.filter((it) => it.key !== key));
  };

  const priceFor = (p: Product) => {
    // Counter customers pay MRP/retail; regular (trade) customers get the wholesale rate when one is set.
    if (party?.kind === "customer" && p.wholesalePrice > 0) return p.wholesalePrice;
    return p.retailPrice > 0 ? p.retailPrice : p.wholesalePrice;
  };

  const addProduct = (p: Product) => {
    touch();
    setItems((current) => {
      const existing = current.find((i) => i.productId === p._id && !i.orderId);
      if (existing && p.trackSerial) return current;
      if (existing) return current.map((i) => (i === existing ? { ...i, quantity: (Number(i.quantity) || 0) + 1 } : i));
      return [
        ...current,
        {
          key: nextKey(),
          productId: p._id,
          productName: p.name,
          quantity: p.trackSerial ? 0 : 1,
          unit: p.unit,
          unitPrice: priceFor(p),
          discountPercent: 0,
          gstPercent: p.gstPercent ?? 0,
          isNew: false,
          serials: [],
        },
      ];
    });
    setProductQuery("");
    productInputRef.current?.focus();
  };

  const addTypedItem = () => {
    const name = productQuery.trim();
    if (!name) return;
    touch();
    setItems((current) => [
      ...current,
      { key: nextKey(), productName: name, quantity: 1, unit: "pcs", unitPrice: 0, discountPercent: 0, gstPercent: 0, isNew: true, serials: [] },
    ]);
    setProductQuery("");
  };

  const amounts = items.map((i) => lineAmounts(i, billType));
  const grossTotal = round2(amounts.reduce((s, a) => s + a.gross, 0));
  const subtotal = round2(amounts.reduce((s, a) => s + a.taxable, 0));
  const discountTotal = round2(grossTotal - subtotal);
  const taxTotal = round2(amounts.reduce((s, a) => s + a.tax, 0));
  const beforeRound = round2(subtotal + taxTotal);
  const totalAmount = Math.round(beforeRound);
  const roundOff = round2(totalAmount - beforeRound);

  const hasZeroPriceNewItem = items.some((i) => i.isNew && (!i.unitPrice || i.unitPrice <= 0));
  const canMakeBill = items.length > 0 && items.every((i) => i.productName.trim() && Number(i.quantity) > 0) && !hasZeroPriceNewItem;
  const counterMethods: { value: "cash" | "upi" | "bank_transfer"; labelKey: string }[] = [
    { value: "cash", labelKey: "cash" },
    { value: "upi", labelKey: "upi" },
    { value: "bank_transfer", labelKey: "bank" },
  ];
  const orderIds = [...new Set(items.map((i) => i.orderId).filter((id): id is string => Boolean(id)))];
  const businessGstin = profileQuery.data?.tenant?.gstin;

  const makeBill = (next: { stock?: boolean; credit?: boolean } = {}) => {
    const flags = { stock: overrides.stock || Boolean(next.stock), credit: overrides.credit || Boolean(next.credit) };
    setOverrides(flags);
    const input: CreateBillInput = {
      customerId: customerId ?? undefined,
      orderIds,
      items: items.map((i) => ({
        orderId: i.orderId,
        productId: i.productId,
        productName: i.productName.trim(),
        quantity: Number(i.quantity),
        unit: i.unit || "pcs",
        unitPrice: Number(i.unitPrice) || 0,
        discountPercent: i.discountPercent > 0 ? Math.min(100, i.discountPercent) : undefined,
        serials: i.serials.length ? i.serials : undefined,
      })),
      billType,
      allowShortStock: flags.stock || undefined,
      allowOverCreditLimit: flags.credit || undefined,
      // Counter sale: paid in full right here, by the method picked below the total.
      payment: party?.kind === "walk-in" ? { amount: totalAmount, method: counterMethod } : undefined,
    };
    createBillMutation.mutate(input);
  };

  const partyName = party?.kind === "walk-in" ? t("sale.walkInName") : (selectedCustomer?.name ?? "");
  const fieldClass =
    "mt-0.5 h-10 w-full rounded-lg border border-border bg-surface px-2.5 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

  return (
    <div className="fixed inset-0 z-100 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={t("sales.newSaleModal.customerStepTitle")}>
      <div className="relative flex max-h-[94dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl bg-surface shadow-elevation-3 sm:rounded-3xl">
        <div className="flex items-center gap-2 border-b border-border px-5 py-3.5">
          {step === "items" && !(presetCustomerId && customerId === presetCustomerId) ? (
            <button
              type="button"
              onClick={() => setStep("customer")}
              aria-label={t("sales.newSaleModal.back")}
              className="-ml-2 flex h-9 w-9 items-center justify-center rounded-full text-text-muted outline-none hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <ChevronLeft size={20} aria-hidden="true" />
            </button>
          ) : null}
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-bold text-text">
              {step === "customer" ? t("sales.newSaleModal.customerStepTitle") : step === "items" ? partyName : invoice?.invoiceNumber}
            </h2>
            <p className="truncate text-xs text-text-muted">
              {step === "customer"
                ? t("sale.customerHint")
                : step === "items"
                  ? party?.kind === "walk-in"
                    ? t("sale.walkInHint")
                    : selectedCustomer && selectedCustomer.outstanding > 0
                      ? t("sale.customerOwes", { amount: formatCurrency(selectedCustomer.outstanding) })
                      : t("sale.itemsHint")
                  : partyName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("sales.newSaleModal.close")}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-text-muted outline-none transition-colors hover:bg-surface-muted hover:text-text focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {step === "customer" && (
            <>
              <button
                type="button"
                onClick={() => {
                  setParty({ kind: "walk-in" });
                  setItems([]);
                  setStep("items");
                }}
                className="flex w-full items-center gap-3 rounded-2xl border border-border px-4 py-3.5 text-left outline-none transition-colors hover:border-primary/50 hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <Store size={22} className="shrink-0 text-icon" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-text">{t("sale.walkInTitle")}</span>
                  <span className="block text-xs text-text-muted">{t("sale.walkInBody")}</span>
                </span>
              </button>

              <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-text-muted">{t("sale.orPickCustomer")}</p>
              <div className="relative mt-2">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-icon" aria-hidden="true" />
                <input
                  value={customerQuery}
                  onChange={(e) => setCustomerQuery(e.target.value)}
                  placeholder={t("sale.searchCustomer")}
                  aria-label={t("sales.newSaleModal.searchCustomers")}
                  className="h-11 w-full rounded-xl border border-border bg-surface pl-9 pr-3 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="mt-2 max-h-64 divide-y divide-border overflow-y-auto rounded-xl border border-border">
                {allCustomersQuery.isLoading ? <p className="px-3.5 py-3 text-sm text-text-muted">{t("common.loading")}</p> : null}
                {filteredCustomers.map((c: CustomerListItem) => (
                  <button
                    key={c._id}
                    type="button"
                    onClick={() => {
                      setParty({ kind: "customer", id: c._id });
                      setStep("items");
                    }}
                    className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left outline-none transition-colors hover:bg-surface-muted focus-visible:bg-surface-muted"
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <UserRound size={16} className="shrink-0 text-icon" aria-hidden="true" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-text">{c.name}</span>
                        {c.phone ? <span className="block text-xs text-text-muted">{c.phone}</span> : null}
                      </span>
                    </span>
                    {c.outstanding > 0 ? (
                      <span className="shrink-0 text-xs font-semibold text-danger">{t("sale.owes", { amount: formatCurrency(c.outstanding) })}</span>
                    ) : null}
                  </button>
                ))}
                {!allCustomersQuery.isLoading && filteredCustomers.length === 0 ? (
                  <p className="px-3.5 py-3 text-sm text-text-muted">{t("common.noMatches")}</p>
                ) : null}
              </div>

              {!showNewCustomerForm ? (
                <button
                  type="button"
                  onClick={() => {
                    setShowNewCustomerForm(true);
                    setNewCustomerValue("name", customerQuery);
                  }}
                  className="mt-3 flex min-h-11 items-center gap-1.5 text-sm font-semibold text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  <Plus size={15} aria-hidden="true" /> {t("sales.newSaleModal.addNewCustomer")}
                </button>
              ) : (
                <form
                  className="mt-3 space-y-2 rounded-xl border border-border p-3.5"
                  onSubmit={handleNewCustomerSubmit((values) =>
                    createCustomerMutation.mutate({ name: values.name.trim(), phone: values.phone?.trim() || undefined })
                  )}
                  noValidate
                >
                  <TextField label={t("common.name")} error={newCustomerErrors.name?.message} {...registerNewCustomer("name")} />
                  <TextField
                    label={t("sales.newSaleModal.phoneOptional")}
                    type="tel"
                    inputMode="tel"
                    error={newCustomerErrors.phone?.message}
                    {...registerNewCustomer("phone")}
                  />
                  <Button type="submit" className="w-full" isLoading={createCustomerMutation.isPending}>
                    {t("sales.newSaleModal.saveAndContinue")}
                  </Button>
                </form>
              )}
            </>
          )}

          {step === "items" && (party?.kind === "walk-in" || selectedCustomer || presetCustomerId) && (
            <>
              {pendingItemsQuery.isLoading ? <p className="mb-3 text-sm text-text-muted">{t("sales.newSaleModal.loadingPendingOrders")}</p> : null}
              {items.some((i) => i.orderId) ? <p className="mb-3 text-sm text-text-muted">{t("sales.newSaleModal.everythingOrdered")}</p> : null}

              {/* Product finder: type a name, SKU or scan code; pick from your stock list. */}
              <div className="relative">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-icon" aria-hidden="true" />
                <input
                  ref={productInputRef}
                  value={productQuery}
                  onChange={(e) => setProductQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    if (productMatches[0]) addProduct(productMatches[0]);
                    else addTypedItem();
                  }}
                  placeholder={t("sale.findProduct")}
                  aria-label={t("sale.findProduct")}
                  autoFocus={party?.kind === "walk-in"}
                  className="h-12 w-full rounded-xl border border-border bg-surface pl-9 pr-3 text-base text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
              {productQuery.trim() ? (
                <div className="mt-1.5 divide-y divide-border overflow-hidden rounded-xl border border-border">
                  {productMatches.map((p) => {
                    const stock = stockOf(p._id) ?? 0;
                    return (
                      <button
                        key={p._id}
                        type="button"
                        onClick={() => addProduct(p)}
                        className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left outline-none transition-colors hover:bg-surface-muted focus-visible:bg-surface-muted"
                      >
                        <span className="flex min-w-0 items-center gap-2.5">
                          <Package size={16} className="shrink-0 text-icon" aria-hidden="true" />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold text-text">{p.name}</span>
                            <span className={clsx("block text-xs", stock > 0 ? "text-text-muted" : "font-semibold text-danger")}>
                              {stock > 0 ? t("sale.inStock", { qty: formatQty(stock), unit: p.unit }) : t("sale.outOfStock")}
                            </span>
                          </span>
                        </span>
                        <span className="shrink-0 text-sm font-semibold tabular-nums text-text">{formatMoney(priceFor(p))}</span>
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={addTypedItem}
                    className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-sm font-semibold text-primary outline-none hover:bg-surface-muted focus-visible:bg-surface-muted"
                  >
                    <Plus size={15} aria-hidden="true" /> {t("sale.addTyped", { name: productQuery.trim() })}
                  </button>
                </div>
              ) : null}

              {items.length === 0 ? (
                <p className="mt-6 text-center text-sm text-text-muted">{t("sale.noItemsYet")}</p>
              ) : (
                <div className="mt-4 space-y-2.5">
                  {items.map((item, index) => {
                    const stock = stockOf(item.productId);
                    const product = item.productId ? productById.get(item.productId) : undefined;
                    const baseUnit = product?.unit ?? item.unit;
                    const sameProductQty = items
                      .filter((i) => i.productId && i.productId === item.productId)
                      .reduce((s, i) => s + baseQtyOf(i), 0);
                    const short = stock !== undefined && sameProductQty > stock + 1e-9;
                    const serialItem = Boolean(product?.trackSerial);
                    const serialsMissing = serialItem && item.serials.length === 0;
                    const priceMissing = item.isNew && (!item.unitPrice || item.unitPrice <= 0);
                    return (
                      <div key={item.key} className={clsx("rounded-xl border p-3", short || priceMissing || serialsMissing ? "border-warning/60" : "border-border")}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            {item.isNew ? (
                              <input
                                value={item.productName}
                                onChange={(e) => updateItem(item.key, { productName: e.target.value })}
                                placeholder={t("sales.newSaleModal.productNamePlaceholder")}
                                aria-label={t("sales.newSaleModal.productNamePlaceholder")}
                                className="h-9 w-full rounded-lg border border-border bg-surface px-2.5 text-sm font-semibold text-text outline-none focus:border-primary"
                              />
                            ) : (
                              <p className="truncate text-sm font-semibold text-text">{item.productName}</p>
                            )}
                            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-text-muted">
                              {item.orderId ? (
                                <span className="inline-flex items-center gap-1">
                                  <Check size={11} aria-hidden="true" /> {t("sales.newSaleModal.fromOrder")}
                                </span>
                              ) : null}
                              {item.isNew ? <span className="font-semibold text-warning">{t("sale.newItemNote")}</span> : null}
                              {stock !== undefined ? (
                                <span className={short ? "font-semibold text-warning" : undefined}>
                                  {short ? t("sale.onlyInStock", { qty: formatQty(Math.max(0, stock)), unit: baseUnit }) : t("sale.inStock", { qty: formatQty(stock), unit: baseUnit })}
                                </span>
                              ) : null}
                              {billType === "gst" && item.gstPercent > 0 ? <span>GST {item.gstPercent}%</span> : null}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeItem(item.key)}
                            aria-label={t("sales.newSaleModal.removeItem")}
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-icon outline-none transition-colors hover:bg-surface-muted hover:text-danger focus-visible:ring-2 focus-visible:ring-primary/40"
                          >
                            <Trash2 size={15} aria-hidden="true" />
                          </button>
                        </div>
                        <div className="mt-2 grid grid-cols-[1fr_0.8fr_1.1fr_0.8fr] gap-2">
                          <label className="text-xs text-text-muted">
                            {t("sales.newSaleModal.qty")}
                            <input
                              type="number"
                              inputMode="decimal"
                              min={0.001}
                              step="any"
                              value={item.quantity}
                              readOnly={serialItem}
                              onChange={(e) => updateItem(item.key, { quantity: Number(e.target.value) })}
                              className={clsx(fieldClass, serialItem && "bg-surface-muted")}
                            />
                          </label>
                          <label className="text-xs text-text-muted">
                            {t("sales.newSaleModal.unit")}
                            {product?.altUnit && !serialItem ? (
                              <select
                                value={item.unit}
                                onChange={(e) => {
                                  const next = e.target.value;
                                  const factor = product.altUnit!.factor;
                                  const toAlt = next === product.altUnit!.name && item.unit !== next;
                                  const toBase = next === product.unit && item.unit !== next;
                                  const price = toAlt ? item.unitPrice * factor : toBase ? item.unitPrice / factor : item.unitPrice;
                                  updateItem(item.key, { unit: next, unitPrice: Math.round(price * 100) / 100 });
                                }}
                                className={fieldClass}
                              >
                                <option value={product.unit}>{product.unit}</option>
                                <option value={product.altUnit.name}>
                                  {product.altUnit.name} ({formatQty(product.altUnit.factor)} {product.unit})
                                </option>
                              </select>
                            ) : (
                              <input value={item.unit} readOnly={serialItem} onChange={(e) => updateItem(item.key, { unit: e.target.value })} className={fieldClass} />
                            )}
                          </label>
                          <label className={clsx("text-xs", priceMissing ? "font-semibold text-danger" : "text-text-muted")}>
                            {t("sales.newSaleModal.price")}
                            {item.isNew ? " *" : ""}
                            <input
                              type="number"
                              inputMode="decimal"
                              min={0}
                              step="any"
                              value={item.unitPrice}
                              onChange={(e) => updateItem(item.key, { unitPrice: Number(e.target.value) })}
                              className={clsx(fieldClass, priceMissing && "border-danger")}
                            />
                          </label>
                          <label className="text-xs text-text-muted">
                            {t("sale.discount")}
                            <input
                              type="number"
                              inputMode="decimal"
                              min={0}
                              max={100}
                              step="any"
                              value={item.discountPercent || ""}
                              placeholder="0"
                              onChange={(e) => updateItem(item.key, { discountPercent: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })}
                              className={fieldClass}
                            />
                          </label>
                        </div>
                        {serialItem && item.productId ? (
                          <SerialPicker
                            productId={item.productId}
                            value={item.serials}
                            onChange={(serials) => updateItem(item.key, { serials, quantity: serials.length })}
                          />
                        ) : null}
                        <p className="mt-1.5 text-right text-sm font-semibold tabular-nums text-text">{formatMoney(amounts[index].total)}</p>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="mt-5">
                <p className="mb-1.5 text-sm font-semibold text-text">{t("sale.billKind")}</p>
                <SegmentedControl
                  className="w-full"
                  segments={[
                    { key: "record", label: t("sale.simpleBill") },
                    { key: "gst", label: t("sales.newSaleModal.gstBill") },
                  ]}
                  active={billType}
                  onChange={(key) => {
                    touch();
                    setBillType(key as BillType);
                  }}
                />
                <p className="mt-1.5 text-xs text-text-muted">
                  {billType === "gst" ? (businessGstin ? t("sales.newSaleModal.gstBillDescription") : t("sale.noGstinYet")) : t("sales.newSaleModal.recordBillDescription")}
                </p>
              </div>

              {blocked?.kind === "stock" ? (
                <div className="mt-4 rounded-xl border border-warning/60 px-3.5 py-3" role="alert">
                  <p className="flex items-center gap-1.5 text-sm font-bold text-text">
                    <AlertTriangle size={15} className="text-warning" aria-hidden="true" /> {t("sale.shortTitle")}
                  </p>
                  <ul className="mt-1.5 space-y-0.5 text-sm text-text">
                    {blocked.shortages.map((s) => (
                      <li key={s.productId}>
                        {t("sale.shortLine", { name: s.productName, requested: formatQty(s.requested), available: formatQty(s.available), unit: s.unit })}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1.5 text-xs text-text-muted">{t("sale.shortBody")}</p>
                  <div className="mt-3 flex gap-2">
                    <Button variant="secondary" className="flex-1" onClick={() => setBlocked(null)}>
                      {t("sale.fixQuantity")}
                    </Button>
                    <Button className="flex-1" isLoading={createBillMutation.isPending} onClick={() => makeBill({ stock: true })}>
                      {t("sale.billAnyway")}
                    </Button>
                  </div>
                </div>
              ) : null}

              {blocked?.kind === "credit" ? (
                <div className="mt-4 rounded-xl border border-warning/60 px-3.5 py-3" role="alert">
                  <p className="flex items-center gap-1.5 text-sm font-bold text-text">
                    <AlertTriangle size={15} className="text-warning" aria-hidden="true" /> {t("sale.creditTitle")}
                  </p>
                  <p className="mt-1.5 text-sm text-text">
                    {t("sale.creditBody", {
                      limit: formatCurrency(blocked.details.creditLimit),
                      owes: formatCurrency(blocked.details.outstanding),
                      after: formatCurrency(blocked.details.afterBill),
                    })}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <Button variant="secondary" className="flex-1" onClick={() => setBlocked(null)}>
                      {t("sale.changeBill")}
                    </Button>
                    <Button className="flex-1" isLoading={createBillMutation.isPending} onClick={() => makeBill({ credit: true })}>
                      {t("sale.billAnyway")}
                    </Button>
                  </div>
                </div>
              ) : null}
            </>
          )}

          {step === "payment" && invoice && (
            <>
              <div className="rounded-2xl bg-surface-muted px-4 py-3.5 text-center">
                <p className="text-sm text-text-muted">{t("sale.billTotal")}</p>
                <p className="text-3xl font-bold tabular-nums text-text">{formatMoney(invoice.totalAmount)}</p>
                {(invoice.taxTotal ?? 0) > 0 ? <p className="mt-0.5 text-xs text-text-muted">{t("sale.includesGst", { amount: formatMoney(invoice.taxTotal) })}</p> : null}
              </div>

              <p className="mt-5 text-sm font-semibold text-text">{t("sale.howPaid")}</p>
              <div className="mt-2 grid grid-cols-4 gap-1.5">
                {paymentMethods.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setMethod(m.value)}
                    aria-pressed={method === m.value}
                    className={clsx(
                      "min-h-11 rounded-xl border px-2 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/40",
                      method === m.value ? "border-text bg-text text-surface" : "border-border text-text hover:bg-surface-muted"
                    )}
                  >
                    {t(`sales.newSaleModal.methodLabel.${m.labelKey}`)}
                  </button>
                ))}
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-text" htmlFor="paymentAmount">
                    {t("sales.newSaleModal.amountReceived")}
                  </label>
                  <button
                    type="button"
                    onClick={() => setAmount(String(invoice.totalAmount))}
                    className="rounded-lg px-2 py-1 text-xs font-semibold text-primary outline-none hover:bg-primary-container focus-visible:ring-2 focus-visible:ring-primary/40"
                  >
                    {t("sale.fullPaid")}
                  </button>
                </div>
                <input
                  id="paymentAmount"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={invoice.totalAmount}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                  className="mt-1.5 h-12 w-full rounded-xl border border-border bg-surface px-3.5 text-lg font-semibold tabular-nums text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                {Number(amount) > 0 && Number(amount) < invoice.totalAmount ? (
                  <p className="mt-1 text-xs font-semibold text-warning">
                    {t("sales.newSaleModal.partialPaymentRemaining", { amount: formatCurrency(invoice.totalAmount - Number(amount)) })}
                  </p>
                ) : null}
                {Number(amount) > invoice.totalAmount ? (
                  <p className="mt-1 text-xs font-semibold text-text">
                    {t("sale.returnChange", { amount: formatMoney(Number(amount) - invoice.totalAmount) })}
                  </p>
                ) : null}
              </div>
            </>
          )}

          {step === "done" && invoice && (
            <div className="py-2">
              <div className="flex flex-col items-center text-center">
                <Check size={30} className="text-success" aria-hidden="true" />
                <h3 className="mt-2 text-lg font-bold text-text">{t("sales.newSaleModal.saleComplete")}</h3>
                <p className="mt-0.5 text-sm text-text-muted">
                  {invoice.invoiceNumber} · {formatMoney(invoice.totalAmount)} ·{" "}
                  {invoice.paymentStatus === "paid"
                    ? t("sales.newSaleModal.fullyPaid")
                    : invoice.amountPaid > 0
                      ? t("sales.newSaleModal.partiallyPaid")
                      : t("sale.onCredit")}
                </p>
              </div>
              <div className="mt-5">
                <BillActions invoice={invoice} />
              </div>
            </div>
          )}
        </div>

        {step === "items" ? (
          <div className="border-t border-border bg-surface-muted px-5 py-3.5">
            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0 text-xs text-text-muted tabular-nums">
                {discountTotal > 0 ? <p>{t("sale.discountLine", { amount: formatMoney(discountTotal) })}</p> : null}
                {taxTotal > 0 ? <p>{t("sale.gstLine", { amount: formatMoney(taxTotal) })}</p> : null}
                {roundOff !== 0 ? <p>{t("sale.roundOffLine", { amount: formatMoney(roundOff) })}</p> : null}
                <p className="text-sm font-semibold text-text">{t("sales.newSaleModal.total")}</p>
              </div>
              <p className="text-2xl font-bold tabular-nums text-text">{formatMoney(totalAmount)}</p>
            </div>
            {party?.kind === "walk-in" ? (
              <div className="mt-3 flex items-center gap-2">
                <span className="shrink-0 text-xs font-semibold text-text-muted">{t("sale.paidBy")}</span>
                <div className="grid flex-1 grid-cols-3 gap-1.5">
                  {counterMethods.map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => setCounterMethod(m.value)}
                      aria-pressed={counterMethod === m.value}
                      className={clsx(
                        "min-h-10 rounded-lg border text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/40",
                        counterMethod === m.value ? "border-text bg-text text-surface" : "border-border bg-surface text-text hover:bg-surface-muted"
                      )}
                    >
                      {t(`sales.newSaleModal.methodLabel.${m.labelKey}`)}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            <Button className="mt-3 w-full" disabled={!canMakeBill || Boolean(blocked)} isLoading={createBillMutation.isPending && !blocked} onClick={() => makeBill()}>
              {party?.kind === "walk-in" ? t("sale.makeBillPaid", { amount: formatMoney(totalAmount) }) : t("sale.makeBill")}
            </Button>
          </div>
        ) : null}

        {step === "payment" && invoice ? (
          <div className="flex gap-3 border-t border-border bg-surface-muted px-5 py-3.5">
            <Button variant="secondary" className="flex-1" onClick={() => setStep("done")}>
              {party?.kind === "walk-in" ? t("sales.newSaleModal.skipForNow") : t("sale.payLater")}
            </Button>
            <Button
              className="flex-1"
              disabled={!amount || Number(amount) <= 0}
              isLoading={paymentMutation.isPending}
              onClick={() =>
                paymentMutation.mutate({ invoiceId: invoice._id, amount: Math.min(Number(amount), invoice.totalAmount), method })
              }
            >
              {t("sales.newSaleModal.confirmPayment")}
            </Button>
          </div>
        ) : null}

        {step === "done" ? (
          <div className="flex gap-3 border-t border-border bg-surface-muted px-5 py-3.5">
            <Button variant="secondary" className="flex-1" onClick={resetAll}>
              {t("sale.nextSale")}
            </Button>
            <Button className="flex-1" onClick={onClose}>
              {t("sales.newSaleModal.done")}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
