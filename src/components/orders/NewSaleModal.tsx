import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { AlertTriangle, Check, FileText, Plus, Receipt, ReceiptText, Trash2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
import { TextField } from "../ui/TextField";
import { listCustomers, createCustomer, type CustomerListItem } from "../../lib/customers-api";
import {
  getCustomerPendingItems,
  createBill,
  recordPayment,
  type BillType,
  type Invoice,
  type PaymentMethod,
} from "../../lib/invoices-api";
import { ApiError } from "../../lib/api";
import { showError } from "../../lib/toast";
import { formatCurrency } from "../../lib/format";
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
  isNew: boolean;
}

let keySeq = 0;
function nextKey() {
  keySeq += 1;
  return `bill-item-${keySeq}`;
}

function emptyItem(): DraftItem {
  return { key: nextKey(), productName: "", quantity: 1, unit: "pcs", unitPrice: 0, isNew: true };
}

const paymentMethods: { value: PaymentMethod; labelKey: string }[] = [
  { value: "cash", labelKey: "cash" },
  { value: "upi", labelKey: "upi" },
  { value: "bank_transfer", labelKey: "bank" },
  { value: "cheque", labelKey: "cheque" },
  { value: "credit", labelKey: "credit" },
];

type Step = "customer" | "items" | "bill-type" | "payment" | "done";

export function NewSaleModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>("customer");

  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerQuery, setCustomerQuery] = useState("");
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);

  const [items, setItems] = useState<DraftItem[]>([]);
  const [billType, setBillType] = useState<BillType>("record");
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [amount, setAmount] = useState("");

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

  const allCustomersQuery = useQuery({
    queryKey: ["customers", "all"],
    queryFn: () => listCustomers(),
    enabled: open,
  });
  const selectedCustomer = allCustomersQuery.data?.find((c) => c._id === customerId) ?? null;
  const filteredCustomers = allCustomersQuery.data?.filter((c) =>
    c.name.toLowerCase().includes(customerQuery.trim().toLowerCase())
  );

  const pendingItemsQuery = useQuery({
    queryKey: ["invoices", "pending-items", customerId],
    queryFn: () => getCustomerPendingItems(customerId!),
    enabled: Boolean(customerId) && step === "items",
  });

  useEffect(() => {
    if (pendingItemsQuery.data) {
      setItems(
        pendingItemsQuery.data.items.map((i) => ({
          key: nextKey(),
          orderId: i.orderId,
          productId: i.productId,
          productName: i.productName,
          quantity: i.quantity,
          unit: i.unit,
          unitPrice: i.unitPrice,
          isNew: false,
        }))
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingItemsQuery.data]);

  const createCustomerMutation = useMutation({
    mutationFn: createCustomer,
    onSuccess: (customer) => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setCustomerId(customer._id);
      setShowNewCustomerForm(false);
      resetNewCustomerForm({ name: "", phone: "" });
      setStep("items");
    },
    onError: (err) => {
      showError(err instanceof ApiError ? err.message : t("sales.newSaleModal.couldNotAddCustomer"));
    },
  });

  const createBillMutation = useMutation({
    mutationFn: createBill,
    onSuccess: (inv) => {
      setInvoice(inv);
      setAmount(String(inv.totalAmount));
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setStep("payment");
    },
    onError: (err) => {
      showError(err instanceof ApiError ? err.message : t("sales.newSaleModal.couldNotGenerateBill"));
    },
  });

  const paymentMutation = useMutation({
    mutationFn: ({ invoiceId, amount, method }: { invoiceId: string; amount: number; method: PaymentMethod }) =>
      recordPayment(invoiceId, { amount, method }),
    onSuccess: (inv) => {
      setInvoice(inv);
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      setStep("done");
    },
    onError: (err) => {
      showError(err instanceof ApiError ? err.message : t("sales.newSaleModal.couldNotRecordPayment"));
    },
  });

  useEffect(() => {
    if (!open) {
      setStep("customer");
      setCustomerId(null);
      setCustomerQuery("");
      setShowNewCustomerForm(false);
      resetNewCustomerForm({ name: "", phone: "" });
      setItems([]);
      setBillType("record");
      setInvoice(null);
      setMethod("cash");
      setAmount("");
    }
  }, [open, resetNewCustomerForm]);

  if (!open) return null;

  const updateItem = (key: string, patch: Partial<DraftItem>) => {
    setItems((current) => current.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  };
  const removeItem = (key: string) => setItems((current) => current.filter((it) => it.key !== key));
  const addBlankItem = () => setItems((current) => [...current, emptyItem()]);

  const totalAmount = items.reduce((sum, i) => sum + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0), 0);
  const hasZeroPriceNewItem = items.some((i) => i.isNew && (!i.unitPrice || i.unitPrice <= 0));
  const canProceedFromItems =
    items.length > 0 && items.every((i) => i.productName.trim() && i.quantity > 0) && !hasZeroPriceNewItem;

  const orderIds = [...new Set(items.map((i) => i.orderId).filter((id): id is string => Boolean(id)))];

  const handleGenerateBill = () => {
    if (!customerId) return;
    createBillMutation.mutate({
      customerId,
      orderIds,
      items: items.map((i) => ({
        orderId: i.orderId,
        productId: i.productId,
        productName: i.productName.trim(),
        quantity: Number(i.quantity),
        unit: i.unit || "pcs",
        unitPrice: Number(i.unitPrice) || 0,
      })),
      billType,
    });
  };

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/40 p-4">
      <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl bg-surface shadow-elevation-3">
        <button
          type="button"
          onClick={onClose}
          aria-label={t("sales.newSaleModal.close")}
          className="absolute right-4 top-4 z-10 rounded-full p-1.5 text-text-muted outline-none transition-colors hover:bg-surface-muted hover:text-text focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <X size={18} />
        </button>

        <div className="overflow-y-auto p-6">
          {step === "customer" && (
            <>
              <h2 className="text-lg font-bold text-text">{t("sales.newSaleModal.customerStepTitle")}</h2>
              <p className="mt-1 text-sm text-text-muted">{t("sales.newSaleModal.customerStepSubtitle")}</p>

              <div className="mt-4">
                <TextField
                  label={t("sales.newSaleModal.searchCustomers")}
                  value={customerQuery}
                  onChange={(e) => setCustomerQuery(e.target.value)}
                  placeholder={t("sales.newSaleModal.typeAName")}
                  autoFocus
                />
                <div className="mt-2 max-h-56 space-y-1 overflow-y-auto">
                  {filteredCustomers?.map((c: CustomerListItem) => (
                    <button
                      key={c._id}
                      type="button"
                      onClick={() => {
                        setCustomerId(c._id);
                        setStep("items");
                      }}
                      className="flex w-full items-center justify-between rounded-lg border border-border px-3.5 py-2.5 text-left outline-none transition-colors hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/40"
                    >
                      <span className="font-medium text-text">{c.name}</span>
                      {c.phone ? <span className="text-xs text-text-muted">{c.phone}</span> : null}
                    </button>
                  ))}
                  {filteredCustomers?.length === 0 && (
                    <p className="px-1 py-2 text-sm text-text-muted">{t("common.noMatches")}</p>
                  )}
                </div>

                {!showNewCustomerForm ? (
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewCustomerForm(true);
                      setNewCustomerValue("name", customerQuery);
                    }}
                    className="mt-3 flex items-center gap-1.5 text-sm font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary/40"
                  >
                    <Plus size={14} /> {t("sales.newSaleModal.addNewCustomer")}
                  </button>
                ) : (
                  <form
                    className="mt-3 space-y-2 border-t border-border pt-3"
                    onSubmit={handleNewCustomerSubmit((values) =>
                      createCustomerMutation.mutate({
                        name: values.name.trim(),
                        phone: values.phone?.trim() || undefined,
                      })
                    )}
                    noValidate
                  >
                    <TextField label={t("common.name")} error={newCustomerErrors.name?.message} {...registerNewCustomer("name")} />
                    <TextField
                      label={t("sales.newSaleModal.phoneOptional")}
                      error={newCustomerErrors.phone?.message}
                      {...registerNewCustomer("phone")}
                    />
                    <Button type="submit" className="w-full" isLoading={createCustomerMutation.isPending}>
                      {t("sales.newSaleModal.saveAndContinue")}
                    </Button>
                  </form>
                )}
              </div>
            </>
          )}

          {step === "items" && selectedCustomer && (
            <>
              <h2 className="text-lg font-bold text-text">{selectedCustomer.name}</h2>
              <p className="mt-1 text-sm text-text-muted">
                {pendingItemsQuery.isLoading
                  ? t("sales.newSaleModal.loadingPendingOrders")
                  : items.some((i) => i.orderId)
                    ? t("sales.newSaleModal.everythingOrdered")
                    : t("sales.newSaleModal.noPendingOrders")}
              </p>

              <div className="mt-4 space-y-2.5">
                {items.map((item) => (
                  <div
                    key={item.key}
                    className={clsx(
                      "rounded-xl border p-3",
                      item.isNew ? "border-warning/50 bg-warning-container/20" : "border-border bg-surface"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      {item.isNew ? (
                        <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-warning">
                          <AlertTriangle size={12} /> {t("sales.newSaleModal.newItem")}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-success">
                          <Check size={12} /> {t("sales.newSaleModal.fromOrder")}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => removeItem(item.key)}
                        aria-label={t("sales.newSaleModal.removeItem")}
                        className="rounded-full p-1 text-text-muted outline-none transition-colors hover:bg-surface-muted hover:text-danger focus-visible:ring-2 focus-visible:ring-primary/40"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    <input
                      value={item.productName}
                      onChange={(e) => updateItem(item.key, { productName: e.target.value })}
                      placeholder={t("sales.newSaleModal.productNamePlaceholder")}
                      className="mt-2 w-full rounded-lg border border-transparent bg-surface-variant px-3 py-2 text-sm text-text outline-none focus:border-primary"
                    />

                    <div className="mt-2 grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-xs text-text-muted">{t("sales.newSaleModal.qty")}</label>
                        <input
                          type="number"
                          min={0.001}
                          step="any"
                          value={item.quantity}
                          onChange={(e) => updateItem(item.key, { quantity: Number(e.target.value) })}
                          className="mt-0.5 w-full rounded-lg border border-transparent bg-surface-variant px-2.5 py-1.5 text-sm text-text outline-none focus:border-primary"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-text-muted">{t("sales.newSaleModal.unit")}</label>
                        <input
                          value={item.unit}
                          onChange={(e) => updateItem(item.key, { unit: e.target.value })}
                          className="mt-0.5 w-full rounded-lg border border-transparent bg-surface-variant px-2.5 py-1.5 text-sm text-text outline-none focus:border-primary"
                        />
                      </div>
                      <div>
                        <label
                          className={clsx(
                            "text-xs",
                            item.isNew && (!item.unitPrice || item.unitPrice <= 0) ? "font-semibold text-danger" : "text-text-muted"
                          )}
                        >
                          {t("sales.newSaleModal.price")} {item.isNew ? "*" : ""}
                        </label>
                        <input
                          type="number"
                          min={0}
                          step="any"
                          value={item.unitPrice}
                          onChange={(e) => updateItem(item.key, { unitPrice: Number(e.target.value) })}
                          className={clsx(
                            "mt-0.5 w-full rounded-lg border bg-surface-variant px-2.5 py-1.5 text-sm text-text outline-none focus:border-primary",
                            item.isNew && (!item.unitPrice || item.unitPrice <= 0) ? "border-danger" : "border-transparent"
                          )}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={addBlankItem}
                className="mt-2.5 flex items-center gap-1.5 text-sm font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <Plus size={14} /> {t("sales.newSaleModal.addItem")}
              </button>

              <div className="mt-5 flex items-center justify-between rounded-lg bg-surface-variant px-3.5 py-2.5">
                <span className="text-sm font-medium text-text-muted">{t("sales.newSaleModal.total")}</span>
                <span className="text-base font-bold text-text">{formatCurrency(totalAmount)}</span>
              </div>

              <div className="mt-5 flex gap-3">
                <Button variant="secondary" className="flex-1" onClick={() => setStep("customer")}>
                  {t("sales.newSaleModal.back")}
                </Button>
                <Button className="flex-1" disabled={!canProceedFromItems} onClick={() => setStep("bill-type")}>
                  {t("sales.newSaleModal.continue")}
                </Button>
              </div>
            </>
          )}

          {step === "bill-type" && (
            <>
              <h2 className="text-lg font-bold text-text">{t("sales.newSaleModal.chooseBillType")}</h2>
              <p className="mt-1 text-sm text-text-muted">{t("sales.newSaleModal.totalSuffix", { amount: formatCurrency(totalAmount) })}</p>

              <div className="mt-5 space-y-3">
                <button
                  type="button"
                  onClick={() => setBillType("gst")}
                  className={clsx(
                    "flex w-full items-start gap-3 rounded-xl border p-4 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/40",
                    billType === "gst" ? "border-primary bg-primary-container/40" : "border-border hover:border-primary/30"
                  )}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-on-primary">
                    <ReceiptText size={18} />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-text">{t("sales.newSaleModal.gstBill")}</span>
                    <span className="mt-0.5 block text-xs text-text-muted">
                      {t("sales.newSaleModal.gstBillDescription")}
                    </span>
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setBillType("record")}
                  className={clsx(
                    "flex w-full items-start gap-3 rounded-xl border p-4 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/40",
                    billType === "record" ? "border-primary bg-primary-container/40" : "border-border hover:border-primary/30"
                  )}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-variant text-text">
                    <FileText size={18} />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-text">{t("sales.newSaleModal.recordBill")}</span>
                    <span className="mt-0.5 block text-xs text-text-muted">
                      {t("sales.newSaleModal.recordBillDescription")}
                    </span>
                  </span>
                </button>
              </div>

              <div className="mt-5 flex gap-3">
                <Button variant="secondary" className="flex-1" onClick={() => setStep("items")}>
                  {t("sales.newSaleModal.back")}
                </Button>
                <Button className="flex-1" isLoading={createBillMutation.isPending} onClick={handleGenerateBill}>
                  {t("sales.newSaleModal.generateBill")}
                </Button>
              </div>
            </>
          )}

          {step === "payment" && invoice && (
            <>
              <h2 className="text-lg font-bold text-text">{invoice.invoiceNumber}</h2>
              <p className="mt-1 text-sm text-text-muted">{t("sales.newSaleModal.recordPaymentReceived")}</p>

              <div className="mt-4 space-y-1.5 rounded-lg bg-surface-variant px-3.5 py-2.5">
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">{t("sales.newSaleModal.subtotal")}</span>
                  <span className="text-text">{formatCurrency(invoice.subtotal)}</span>
                </div>
                {invoice.taxTotal > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-text-muted">{t("sales.newSaleModal.gst")}</span>
                    <span className="text-text">{formatCurrency(invoice.taxTotal)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-border pt-1.5 text-sm font-bold">
                  <span className="text-text">{t("sales.newSaleModal.total")}</span>
                  <span className="text-text">{formatCurrency(invoice.totalAmount)}</span>
                </div>
              </div>

              <div className="mt-5">
                <p className="mb-1.5 text-sm font-medium text-text-muted">{t("sales.newSaleModal.paymentMethod")}</p>
                <div className="grid grid-cols-5 gap-1.5">
                  {paymentMethods.map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => setMethod(m.value)}
                      className={clsx(
                        "rounded-lg border px-2 py-2 text-xs font-semibold outline-none transition-colors",
                        "focus-visible:ring-2 focus-visible:ring-primary/40",
                        method === m.value
                          ? "border-primary bg-primary-container text-primary"
                          : "border-border text-text-muted hover:border-primary/30"
                      )}
                    >
                      {t(`sales.newSaleModal.methodLabel.${m.labelKey}`)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4">
                <label className="mb-1.5 block text-sm font-medium text-text-muted" htmlFor="paymentAmount">
                  {t("sales.newSaleModal.amountReceived")}
                </label>
                <input
                  id="paymentAmount"
                  type="number"
                  min={0}
                  max={invoice.totalAmount}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full rounded-lg border border-transparent bg-surface-variant px-3.5 py-2.5 text-sm text-text outline-none focus:border-primary"
                />
                {Number(amount) < invoice.totalAmount && Number(amount) > 0 ? (
                  <p className="mt-1 text-xs text-warning">
                    {t("sales.newSaleModal.partialPaymentRemaining", { amount: formatCurrency(invoice.totalAmount - Number(amount)) })}
                  </p>
                ) : null}
              </div>

              <div className="mt-5 flex gap-3">
                <Button variant="secondary" className="flex-1" onClick={onClose}>
                  {t("sales.newSaleModal.skipForNow")}
                </Button>
                <Button
                  className="flex-1"
                  disabled={!amount || Number(amount) <= 0}
                  isLoading={paymentMutation.isPending}
                  onClick={() => paymentMutation.mutate({ invoiceId: invoice._id, amount: Number(amount), method })}
                >
                  {t("sales.newSaleModal.confirmPayment")}
                </Button>
              </div>
            </>
          )}

          {step === "done" && invoice && (
            <div className="flex flex-col items-center py-4 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-success-container text-success">
                <Check size={26} />
              </span>
              <h2 className="mt-4 text-lg font-bold text-text">{t("sales.newSaleModal.saleComplete")}</h2>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-text-muted">
                <Receipt size={14} /> {invoice.invoiceNumber} · {invoice.billType === "gst" ? t("sales.newSaleModal.gstBillShort") : t("sales.newSaleModal.recordBillShort")} ·{" "}
                {invoice.paymentStatus === "paid" ? t("sales.newSaleModal.fullyPaid") : t("sales.newSaleModal.partiallyPaid")}
              </p>
              <Button className="mt-5 w-full" onClick={onClose}>
                {t("sales.newSaleModal.done")}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
