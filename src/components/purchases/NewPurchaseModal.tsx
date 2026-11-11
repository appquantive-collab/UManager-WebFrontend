import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Plus, Trash2 } from "lucide-react";
import clsx from "clsx";
import { Button } from "../ui/Button";
import { Field, FilterChips, ModalShell, inputClass } from "../page/kit";
import { AddSupplierModal } from "../suppliers/AddSupplierModal";
import { listSuppliers } from "../../lib/suppliers-api";
import { listProducts, type Product } from "../../lib/products-api";
import { listWarehouses } from "../../lib/stock-api";
import { createPurchase } from "../../lib/purchases-api";
import type { PaymentMethod } from "../../lib/invoices-api";
import { formatCurrency } from "../../lib/format";
import { ApiError } from "../../lib/api";
import { errorMessage } from "../../lib/api-errors";
import { showError, showSuccess } from "../../lib/toast";

// Record a purchase bill from a supplier: items go into stock, the supplier's
// balance goes up by whatever isn't paid now.

interface Line {
  key: number;
  productId: string;
  quantity: string;
  unitCost: string;
  gstPercent: string;
  unit: string;
  batchNo: string;
  expiryDate: string;
  serialsText: string;
}

let nextLineKey = 1;
const blankLine = (): Line => ({ key: nextLineKey++, productId: "", quantity: "", unitCost: "", gstPercent: "", unit: "", batchNo: "", expiryDate: "", serialsText: "" });
const serialList = (text: string) => [...new Set(text.split(/[\s,;]+/).map((s) => s.trim().toUpperCase()).filter(Boolean))];
const num = (value: string) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
};
const todayInput = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function NewPurchaseModal({ open, onClose, presetSupplierId }: { open: boolean; onClose: () => void; presetSupplierId?: string | null }) {
  if (!open) return null;
  // Remounting per open gives every new purchase a clean form.
  return <PurchaseForm onClose={onClose} presetSupplierId={presetSupplierId ?? ""} />;
}

function PurchaseForm({ onClose, presetSupplierId }: { onClose: () => void; presetSupplierId: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [supplierId, setSupplierId] = useState(presetSupplierId);
  const [warehouseId, setWarehouseId] = useState("");
  const [billNumber, setBillNumber] = useState("");
  const [date, setDate] = useState(todayInput);
  const [lines, setLines] = useState<Line[]>([blankLine()]);
  const [paidNow, setPaidNow] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [addSupplierOpen, setAddSupplierOpen] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  const suppliersQuery = useQuery({ queryKey: ["suppliers"], queryFn: () => listSuppliers() });
  const productsQuery = useQuery({ queryKey: ["products", "all-for-purchase"], queryFn: () => listProducts() });
  const rawQuery = useQuery({ queryKey: ["products", "raw"], queryFn: () => listProducts({ rawMaterial: true }) });
  const warehousesQuery = useQuery({ queryKey: ["stock-warehouses"], queryFn: listWarehouses });

  const products = useMemo(() => {
    const byId = new Map<string, Product>();
    for (const p of [...(productsQuery.data ?? []), ...(rawQuery.data ?? [])]) if (p.isActive) byId.set(p._id, p);
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [productsQuery.data, rawQuery.data]);
  const productById = useMemo(() => new Map(products.map((p) => [p._id, p])), [products]);
  const suppliers = suppliersQuery.data ?? [];
  const warehouses = warehousesQuery.data ?? [];
  const effectiveWarehouseId = warehouseId || warehouses.find((w) => w.isDefault)?._id || warehouses[0]?._id || "";

  const totals = lines.reduce(
    (acc, line) => {
      const subtotal = num(line.quantity) * num(line.unitCost);
      const tax = (subtotal * num(line.gstPercent)) / 100;
      return { subtotal: acc.subtotal + subtotal, tax: acc.tax + tax };
    },
    { subtotal: 0, tax: 0 }
  );
  const total = totals.subtotal + totals.tax;
  const paid = Math.min(num(paidNow), total);
  const validLines = lines.filter((l) => l.productId && num(l.quantity) > 0);
  /** What still needs filling for batch / IMEI items before the purchase can be saved. */
  const lineProblem = (l: Line): string | null => {
    const product = productById.get(l.productId);
    if (!product || num(l.quantity) <= 0) return null;
    if (product.trackBatch && !l.batchNo.trim()) return t("trackEntry.batchNeeded");
    if (product.trackSerial) {
      const needed = product.altUnit && l.unit === product.altUnit.name ? num(l.quantity) * product.altUnit.factor : num(l.quantity);
      if (serialList(l.serialsText).length !== needed) return t("trackEntry.imeiCount", { needed, given: serialList(l.serialsText).length });
    }
    return null;
  };
  const hasLineProblems = validLines.some((l) => lineProblem(l) !== null);

  const updateLine = (key: number, patch: Partial<Line>) =>
    setLines((current) => current.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const pickProduct = (key: number, productId: string) => {
    const product = productById.get(productId);
    updateLine(key, {
      productId,
      // Start from the last cost paid and the product's GST rate.
      unitCost: product?.purchasePrice ? String(product.purchasePrice) : "",
      gstPercent: product?.gstPercent ? String(product.gstPercent) : "",
      unit: product?.unit ?? "",
      batchNo: "",
      expiryDate: "",
      serialsText: "",
    });
  };

  const save = useMutation({
    mutationFn: createPurchase,
    onSuccess: (purchase) => {
      for (const key of [["purchases"], ["suppliers"], ["products"], ["stock-levels"], ["warehouses"], ["dashboard-summary"]]) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
      showSuccess(t("purchases.form.saved", { number: purchase.purchaseNumber }), t("purchases.form.savedHint"));
      onClose();
    },
    onError: (err) => showError(err instanceof ApiError ? errorMessage(err, t) : t("purchases.form.couldNotSave")),
  });

  const submit = () => {
    setShowErrors(true);
    if (!supplierId || validLines.length === 0 || hasLineProblems) return;
    save.mutate({
      supplierId,
      warehouseId: effectiveWarehouseId || undefined,
      supplierBillNumber: billNumber.trim() || undefined,
      // Noon local time keeps the chosen date stable across time zones.
      purchasedAt: new Date(`${date}T12:00:00`).toISOString(),
      items: validLines.map((l) => ({
        productId: l.productId,
        quantity: num(l.quantity),
        unitCost: num(l.unitCost),
        gstPercent: num(l.gstPercent),
        unit: l.unit || undefined,
        batchNo: l.batchNo.trim() || undefined,
        // End of the chosen day, India time.
        expiryDate: l.expiryDate ? new Date(`${l.expiryDate}T23:59:59+05:30`).toISOString() : undefined,
        serials: productById.get(l.productId)?.trackSerial ? serialList(l.serialsText) : undefined,
      })),
      payment: paid > 0 ? { amount: paid, method } : undefined,
    });
  };

  const methods: { key: PaymentMethod; label: string }[] = (["cash", "upi", "bank_transfer", "cheque"] as const).map((key) => ({
    key,
    label: t(`sales.hub.method.${key}`),
  }));

  return (
    <>
      <ModalShell
        open
        onClose={onClose}
        title={t("purchases.form.title")}
        subtitle={t("purchases.form.subtitle")}
        closeLabel={t("purchases.form.close")}
        footer={
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm">
              <span className="text-text-muted">{t("purchases.form.total")}: </span>
              <span className="text-lg font-extrabold tabular-nums text-text">{formatCurrency(total)}</span>
              {total > 0 ? (
                <span className="ml-2 text-text-muted">
                  · {t("purchases.form.willOwe", { amount: formatCurrency(Math.max(0, total - paid)) })}
                </span>
              ) : null}
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={onClose}>
                {t("purchases.form.cancel")}
              </Button>
              <Button onClick={submit} isLoading={save.isPending}>
                {t("purchases.form.save")}
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-6">
          {/* 1. Who and when */}
          <section className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wide text-text-muted">{t("purchases.form.sectionSupplier")}</h3>
            {suppliers.length === 0 && !suppliersQuery.isLoading ? (
              <div className="rounded-xl border border-dashed border-border bg-surface-muted p-4 text-sm">
                <p className="font-semibold text-text">{t("purchases.form.noSuppliers")}</p>
                <p className="mt-1 text-text-muted">{t("purchases.form.noSuppliersHint")}</p>
                <Button className="mt-3" onClick={() => setAddSupplierOpen(true)}>
                  {t("purchases.form.addSupplier")}
                </Button>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t("purchases.form.supplier")} htmlFor="purchase-supplier">
                  <div className="flex gap-2">
                    <select
                      id="purchase-supplier"
                      value={supplierId}
                      onChange={(e) => setSupplierId(e.target.value)}
                      className={clsx(inputClass, showErrors && !supplierId && "border-danger")}
                    >
                      <option value="">{t("purchases.form.chooseSupplier")}</option>
                      {suppliers.map((s) => (
                        <option key={s._id} value={s._id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setAddSupplierOpen(true)}
                      aria-label={t("purchases.form.addSupplier")}
                      title={t("purchases.form.addSupplier")}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border text-text outline-none hover:border-primary hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/40"
                    >
                      <Plus size={18} aria-hidden="true" />
                    </button>
                  </div>
                  {showErrors && !supplierId ? <p className="text-xs font-semibold text-danger">{t("purchases.form.supplierRequired")}</p> : null}
                </Field>
                <Field label={t("purchases.form.billNumber")} hint={t("purchases.form.billNumberHint")} htmlFor="purchase-bill">
                  <input id="purchase-bill" value={billNumber} onChange={(e) => setBillNumber(e.target.value)} className={inputClass} placeholder="e.g. 2381" />
                </Field>
                <Field label={t("purchases.form.date")} htmlFor="purchase-date">
                  <input id="purchase-date" type="date" value={date} max={todayInput()} onChange={(e) => setDate(e.target.value)} className={inputClass} />
                </Field>
                {warehouses.length > 1 ? (
                  <Field label={t("purchases.form.warehouse")} hint={t("purchases.form.warehouseHint")} htmlFor="purchase-warehouse">
                    <select id="purchase-warehouse" value={effectiveWarehouseId} onChange={(e) => setWarehouseId(e.target.value)} className={inputClass}>
                      {warehouses.map((w) => (
                        <option key={w._id} value={w._id}>
                          {w.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                ) : null}
              </div>
            )}
          </section>

          {/* 2. What was bought */}
          <section className="space-y-3">
            <div className="flex items-end justify-between gap-2">
              <h3 className="text-sm font-bold uppercase tracking-wide text-text-muted">{t("purchases.form.sectionItems")}</h3>
              <p className="text-xs text-text-muted">{t("purchases.form.itemsHint")}</p>
            </div>
            {products.length === 0 && !productsQuery.isLoading ? (
              <p className="rounded-xl border border-dashed border-border bg-surface-muted p-4 text-sm text-text-muted">{t("purchases.form.noProducts")}</p>
            ) : null}
            <div className="space-y-2">
              {lines.map((line, index) => {
                const lineTotal = num(line.quantity) * num(line.unitCost) * (1 + num(line.gstPercent) / 100);
                const product = productById.get(line.productId);
                return (
                  <div key={line.key} className="grid grid-cols-12 items-end gap-2 rounded-xl border border-border bg-background p-3">
                    <div className="col-span-12 sm:col-span-5">
                      <label className="mb-1 block text-xs font-semibold text-text-muted" htmlFor={`line-product-${line.key}`}>
                        {t("purchases.form.product")} {index + 1}
                      </label>
                      <select
                        id={`line-product-${line.key}`}
                        value={line.productId}
                        onChange={(e) => pickProduct(line.key, e.target.value)}
                        className={clsx(inputClass, showErrors && !line.productId && validLines.length === 0 && "border-danger")}
                      >
                        <option value="">{t("purchases.form.chooseProduct")}</option>
                        {products.map((p) => (
                          <option key={p._id} value={p._id}>
                            {p.name}
                            {p.isRawMaterial ? ` (${t("purchases.form.rawMaterial")})` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-4 sm:col-span-2">
                      <label className="mb-1 block text-xs font-semibold text-text-muted" htmlFor={`line-qty-${line.key}`}>
                        {t("purchases.form.quantity")} {product && !product.altUnit ? `(${product.unit})` : ""}
                      </label>
                      <div className="flex gap-1">
                        <input
                          id={`line-qty-${line.key}`}
                          type="number"
                          inputMode="decimal"
                          min={0}
                          value={line.quantity}
                          onChange={(e) => updateLine(line.key, { quantity: e.target.value })}
                          className={clsx(inputClass, "min-w-0")}
                        />
                        {product?.altUnit ? (
                          <select
                            aria-label={t("sales.newSaleModal.unit")}
                            value={line.unit || product.unit}
                            onChange={(e) => {
                              const next = e.target.value;
                              const factor = product.altUnit!.factor;
                              const cost = num(line.unitCost);
                              const prev = line.unit || product.unit;
                              const nextCost = prev === next ? cost : next === product.altUnit!.name ? cost * factor : cost / factor;
                              updateLine(line.key, { unit: next, unitCost: cost ? String(Math.round(nextCost * 100) / 100) : line.unitCost });
                            }}
                            className="h-11 w-20 shrink-0 rounded-xl border border-border bg-surface px-1.5 text-sm text-text outline-none focus:border-primary"
                          >
                            <option value={product.unit}>{product.unit}</option>
                            <option value={product.altUnit.name}>{product.altUnit.name}</option>
                          </select>
                        ) : null}
                      </div>
                    </div>
                    <div className="col-span-4 sm:col-span-2">
                      <label className="mb-1 block text-xs font-semibold text-text-muted" htmlFor={`line-cost-${line.key}`}>
                        {t("purchases.form.costEach")}
                      </label>
                      <input
                        id={`line-cost-${line.key}`}
                        type="number"
                        inputMode="decimal"
                        min={0}
                        value={line.unitCost}
                        onChange={(e) => updateLine(line.key, { unitCost: e.target.value })}
                        className={inputClass}
                      />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <label className="mb-1 block text-xs font-semibold text-text-muted" htmlFor={`line-gst-${line.key}`}>
                        GST %
                      </label>
                      <input
                        id={`line-gst-${line.key}`}
                        type="number"
                        inputMode="decimal"
                        min={0}
                        max={28}
                        value={line.gstPercent}
                        onChange={(e) => updateLine(line.key, { gstPercent: e.target.value })}
                        className={inputClass}
                      />
                    </div>
                    <div className="col-span-2 flex items-center justify-end gap-1 sm:col-span-2">
                      <span className="text-sm font-bold tabular-nums text-text">{formatCurrency(lineTotal)}</span>
                      {lines.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => setLines((current) => current.filter((l) => l.key !== line.key))}
                          aria-label={t("purchases.form.removeItem")}
                          className="flex h-9 w-9 items-center justify-center rounded-lg text-text-muted outline-none hover:bg-danger-container hover:text-danger focus-visible:ring-2 focus-visible:ring-danger/40"
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      ) : null}
                    </div>
                    {product?.trackBatch ? (
                      <div className="col-span-12 grid grid-cols-2 gap-2">
                        <label className="text-xs font-semibold text-text-muted">
                          {t("trackEntry.batchNo")}
                          <input
                            value={line.batchNo}
                            onChange={(e) => updateLine(line.key, { batchNo: e.target.value.toUpperCase() })}
                            className={clsx(inputClass, "mt-1 uppercase", showErrors && !line.batchNo.trim() && "border-danger")}
                          />
                        </label>
                        <label className="text-xs font-semibold text-text-muted">
                          {t("trackEntry.expiry")}
                          <input
                            type="date"
                            value={line.expiryDate}
                            onChange={(e) => updateLine(line.key, { expiryDate: e.target.value })}
                            className={clsx(inputClass, "mt-1")}
                          />
                        </label>
                      </div>
                    ) : null}
                    {product?.trackSerial ? (
                      <label className="col-span-12 text-xs font-semibold text-text-muted">
                        {t("trackEntry.imeis")}
                        <textarea
                          rows={2}
                          value={line.serialsText}
                          onChange={(e) => updateLine(line.key, { serialsText: e.target.value })}
                          placeholder={t("trackEntry.imeiPlaceholder")}
                          className={clsx(inputClass, "mt-1 h-auto py-2 font-mono uppercase")}
                        />
                      </label>
                    ) : null}
                    {showErrors && lineProblem(line) ? (
                      <p className="col-span-12 text-xs font-semibold text-danger">{lineProblem(line)}</p>
                    ) : null}
                  </div>
                );
              })}
            </div>
            {showErrors && validLines.length === 0 ? <p className="text-xs font-semibold text-danger">{t("purchases.form.itemsRequired")}</p> : null}
            <button
              type="button"
              onClick={() => setLines((current) => [...current, blankLine()])}
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-semibold text-primary outline-none hover:bg-primary-container focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <Plus size={16} aria-hidden="true" />
              {t("purchases.form.addItem")}
            </button>

            <dl className="ml-auto max-w-xs space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-text-muted">{t("purchases.form.subtotal")}</dt>
                <dd className="tabular-nums text-text">{formatCurrency(totals.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text-muted">GST</dt>
                <dd className="tabular-nums text-text">{formatCurrency(totals.tax)}</dd>
              </div>
              <div className="flex justify-between border-t border-border pt-1 font-bold">
                <dt className="text-text">{t("purchases.form.total")}</dt>
                <dd className="tabular-nums text-text">{formatCurrency(total)}</dd>
              </div>
            </dl>
          </section>

          {/* 3. Paid now? */}
          <section className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wide text-text-muted">{t("purchases.form.sectionPayment")}</h3>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setPaidNow("")}
                className={clsx(
                  "rounded-xl border px-3.5 py-2 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                  paid === 0 ? "border-primary bg-primary-container text-primary" : "border-border text-text"
                )}
              >
                {t("purchases.form.payLater")}
              </button>
              <button
                type="button"
                onClick={() => setPaidNow(String(Math.round(total * 100) / 100))}
                disabled={total <= 0}
                className={clsx(
                  "rounded-xl border px-3.5 py-2 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-40",
                  total > 0 && paid >= total - 0.01 ? "border-primary bg-primary-container text-primary" : "border-border text-text"
                )}
              >
                {t("purchases.form.paidFull")}
              </button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("purchases.form.paidAmount")} hint={t("purchases.form.paidAmountHint")} htmlFor="purchase-paid">
                <input
                  id="purchase-paid"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  value={paidNow}
                  onChange={(e) => setPaidNow(e.target.value)}
                  className={inputClass}
                  placeholder="0"
                />
              </Field>
              {paid > 0 ? (
                <Field label={t("purchases.form.method")}>
                  <FilterChips label={t("purchases.form.method")} options={methods} value={method} onChange={setMethod} />
                </Field>
              ) : null}
            </div>
          </section>
        </div>
      </ModalShell>
      <AddSupplierModal open={addSupplierOpen} onClose={() => setAddSupplierOpen(false)} />
    </>
  );
}
