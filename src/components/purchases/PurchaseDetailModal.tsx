import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
import { Field, FilterChips, ModalShell, StatusPill, inputClass } from "../page/kit";
import { purchaseStatusTone, recordPurchasePayment, supplierOf, type Purchase } from "../../lib/purchases-api";
import type { PaymentMethod } from "../../lib/invoices-api";
import { formatCurrency } from "../../lib/format";
import { ApiError } from "../../lib/api";
import { showError, showSuccess } from "../../lib/toast";

export function PurchaseDetailModal({ purchase, onClose }: { purchase: Purchase | null; onClose: () => void }) {
  if (!purchase) return null;
  // Keyed so the payment form resets for each purchase opened.
  return <PurchaseDetail key={purchase._id} initial={purchase} onClose={onClose} />;
}

function PurchaseDetail({ initial, onClose }: { initial: Purchase; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [purchase, setPurchase] = useState(initial);
  const balance = Math.max(0, purchase.totalAmount - purchase.amountPaid);
  const [amount, setAmount] = useState(balance > 0 ? String(Math.round(balance * 100) / 100) : "");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [note, setNote] = useState("");

  const locale = i18n.resolvedLanguage === "hi" ? "hi-IN" : "en-IN";
  const formatDate = (iso: string) => new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
  const supplier = supplierOf(purchase);
  const warehouseName = typeof purchase.warehouseId === "string" ? "" : purchase.warehouseId.name;

  const pay = useMutation({
    mutationFn: () => recordPurchasePayment(purchase._id, { amount: Number(amount), method, note: note.trim() || undefined }),
    onSuccess: (updated) => {
      setPurchase(updated);
      const left = Math.max(0, updated.totalAmount - updated.amountPaid);
      setAmount(left > 0 ? String(Math.round(left * 100) / 100) : "");
      setNote("");
      for (const key of [["purchases"], ["suppliers"], ["dashboard-summary"]]) void queryClient.invalidateQueries({ queryKey: key });
      showSuccess(t("purchases.detail.paymentSaved"));
    },
    onError: (err) => showError(err instanceof ApiError ? err.message : t("purchases.detail.couldNotPay")),
  });

  const amountValue = Number(amount);
  const canPay = Number.isFinite(amountValue) && amountValue > 0 && amountValue <= balance + 0.01;

  return (
    <ModalShell
      open
      onClose={onClose}
      title={`${purchase.purchaseNumber} · ${supplier.name}`}
      subtitle={[
        formatDate(purchase.purchasedAt),
        purchase.supplierBillNumber ? t("purchases.detail.supplierBill", { number: purchase.supplierBillNumber }) : null,
        warehouseName ? t("purchases.detail.into", { warehouse: warehouseName }) : null,
      ]
        .filter(Boolean)
        .join(" · ")}
      closeLabel={t("purchases.form.close")}
    >
      <div className="space-y-6">
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-max text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-muted text-left text-xs font-bold uppercase tracking-wide text-text-muted">
                <th className="px-3 py-2">{t("purchases.form.product")}</th>
                <th className="px-3 py-2 text-right">{t("purchases.form.quantity")}</th>
                <th className="px-3 py-2 text-right">{t("purchases.form.costEach")}</th>
                <th className="px-3 py-2 text-right">GST</th>
                <th className="px-3 py-2 text-right">{t("purchases.form.total")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {purchase.items.map((item, i) => (
                <tr key={`${item.productId}-${i}`}>
                  <td className="px-3 py-2 font-semibold text-text">{item.productName}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-text">
                    {item.quantity} {item.unit}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-text">{formatCurrency(item.unitCost)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-text-muted">{item.gstPercent}%</td>
                  <td className="px-3 py-2 text-right font-bold tabular-nums text-text">{formatCurrency(item.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <dl className="ml-auto max-w-xs space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-text-muted">{t("purchases.form.subtotal")}</dt>
            <dd className="tabular-nums text-text">{formatCurrency(purchase.subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-text-muted">GST</dt>
            <dd className="tabular-nums text-text">{formatCurrency(purchase.taxTotal)}</dd>
          </div>
          <div className="flex justify-between border-t border-border pt-1 font-bold">
            <dt className="text-text">{t("purchases.form.total")}</dt>
            <dd className="tabular-nums text-text">{formatCurrency(purchase.totalAmount)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-text-muted">{t("purchases.detail.paid")}</dt>
            <dd className="tabular-nums text-success">{formatCurrency(purchase.amountPaid)}</dd>
          </div>
          <div className="flex justify-between font-bold">
            <dt className="text-text">{t("purchases.detail.stillToPay")}</dt>
            <dd className={balance > 0 ? "tabular-nums text-danger" : "tabular-nums text-text-muted"}>{formatCurrency(balance)}</dd>
          </div>
        </dl>

        {purchase.payments.length > 0 ? (
          <section>
            <h3 className="mb-2 text-sm font-bold text-text">{t("purchases.detail.history")}</h3>
            <ul className="divide-y divide-border rounded-xl border border-border">
              {purchase.payments.map((p, i) => (
                <li key={i} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <span className="text-text">
                    {formatDate(p.paidAt)} · {t(`sales.hub.method.${p.method}`)}
                    {p.note ? <span className="text-text-muted"> · {p.note}</span> : null}
                  </span>
                  <span className="font-bold tabular-nums text-success">{formatCurrency(p.amount)}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {balance > 0 ? (
          <section className="space-y-3 rounded-2xl border border-primary/25 bg-primary-container/40 p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-text">{t("purchases.detail.paySupplier")}</h3>
              <StatusPill tone={purchaseStatusTone[purchase.paymentStatus]}>{t(`purchases.status.${purchase.paymentStatus}`)}</StatusPill>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("purchases.detail.amount")} hint={t("purchases.detail.amountHint")} htmlFor="pay-amount">
                <input id="pay-amount" type="number" inputMode="decimal" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} />
              </Field>
              <Field label={t("purchases.form.method")}>
                <FilterChips
                  label={t("purchases.form.method")}
                  value={method}
                  onChange={setMethod}
                  options={(["cash", "upi", "bank_transfer", "cheque"] as const).map((key) => ({ key, label: t(`sales.hub.method.${key}`) }))}
                />
              </Field>
            </div>
            <Field label={t("purchases.detail.note")} htmlFor="pay-note">
              <input id="pay-note" value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} placeholder={t("purchases.detail.notePlaceholder")} />
            </Field>
            <Button onClick={() => pay.mutate()} disabled={!canPay} isLoading={pay.isPending}>
              {t("purchases.detail.savePayment")}
            </Button>
          </section>
        ) : (
          <p className="rounded-xl bg-success-container px-4 py-3 text-sm font-semibold text-success">{t("purchases.detail.fullyPaid")}</p>
        )}
      </div>
    </ModalShell>
  );
}
