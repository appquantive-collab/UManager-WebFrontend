import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import { Minus, Plus, X } from "lucide-react";
import { Button } from "../ui/Button";
import { createReturn, getReturnable, type RefundMethod } from "../../lib/returns-api";
import type { Invoice } from "../../lib/invoices-api";
import { errorMessage } from "../../lib/api-errors";
import { showError, showSuccess } from "../../lib/toast";
import { formatMoney, formatQty } from "../../lib/format";

const refundMethods: { value: RefundMethod; labelKey: string }[] = [
  { value: "cash", labelKey: "cash" },
  { value: "upi", labelKey: "upi" },
  { value: "bank_transfer", labelKey: "bank" },
];

/**
 * Goods coming back on a bill. Pick how many of each; the value first clears
 * what the customer still owes on this bill, the rest is paid back.
 */
export function ReturnModal({ invoice, open, onClose }: { invoice: Invoice; open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [qty, setQty] = useState<Record<string, number>>({});
  const [serials, setSerials] = useState<Record<string, string[]>>({});
  const [refundMethod, setRefundMethod] = useState<RefundMethod>("cash");
  const [reason, setReason] = useState("");

  const returnable = useQuery({
    queryKey: ["returnable", invoice._id],
    queryFn: () => getReturnable(invoice._id),
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;
    setQty({});
    setSerials({});
    setReason("");
    setRefundMethod("cash");
  }, [open]);

  const items = useMemo(() => returnable.data?.items ?? [], [returnable.data]);
  const value = items.reduce((s, i) => s + (qty[i.productId] ?? 0) * (i.unitPrice + i.unitTax), 0);
  const due = Math.max(0, invoice.totalAmount - invoice.amountPaid);
  const adjusted = Math.min(value, due);
  const refund = Math.max(0, value - adjusted);
  const chosen = items.filter((i) => (qty[i.productId] ?? 0) > 0);

  const mutation = useMutation({
    mutationFn: () =>
      createReturn({
        invoiceId: invoice._id,
        items: chosen.map((i) => ({
          productId: i.productId,
          quantity: qty[i.productId],
          serials: i.serials.length ? serials[i.productId] : undefined,
        })),
        refundMethod: refund > 0 ? refundMethod : undefined,
        reason: reason.trim() || undefined,
      }),
    onSuccess: (ret) => {
      showSuccess(t("returns.done", { number: ret.returnNumber }));
      for (const key of ["invoices", "customers", "dashboard", "stock-levels", "stock-level", "returnable", "customer-portfolio", "daybook"]) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
      onClose();
    },
    onError: (err) => showError(errorMessage(err, t)),
  });

  if (!open) return null;

  const setQuantity = (productId: string, next: number, max: number) =>
    setQty((q) => ({ ...q, [productId]: Math.min(max, Math.max(0, Math.round(next * 1000) / 1000)) }));

  const serialProblem = chosen.some((i) => i.serials.length > 0 && (serials[i.productId]?.length ?? 0) !== qty[i.productId]);

  return (
    <div className="fixed inset-0 z-110 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={t("returns.title")}>
      <button type="button" aria-label={t("common.close")} className="absolute inset-0 cursor-default" onClick={onClose} />
      <div className="relative z-10 flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-surface shadow-elevation-3 sm:rounded-3xl">
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-text">{t("returns.title")}</h2>
            <p className="mt-0.5 text-sm text-text-muted">{t("returns.subtitle", { number: invoice.invoiceNumber })}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
            className="flex h-9 w-9 items-center justify-center rounded-full text-text-muted outline-none hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {returnable.isLoading ? <p className="text-sm text-text-muted">{t("common.loading")}</p> : null}
          <div className="space-y-2.5">
            {items.map((item) => {
              const current = qty[item.productId] ?? 0;
              const step = Number.isInteger(item.billed) ? 1 : 0.5;
              return (
                <div key={item.productId} className={clsx("rounded-xl border p-3", current > 0 ? "border-primary/50" : "border-border")}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-text">{item.productName}</p>
                      <p className="text-xs text-text-muted">
                        {t("returns.billedLine", {
                          billed: formatQty(item.billed),
                          unit: item.unit,
                          price: formatMoney(item.unitPrice + item.unitTax),
                        })}
                        {item.returned > 0 ? ` · ${t("returns.alreadyBack", { qty: formatQty(item.returned) })}` : ""}
                      </p>
                    </div>
                    {item.returnable > 0 ? (
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          aria-label={t("returns.less")}
                          onClick={() => setQuantity(item.productId, current - step, item.returnable)}
                          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-icon outline-none hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-primary/40"
                        >
                          <Minus size={14} aria-hidden="true" />
                        </button>
                        <input
                          type="number"
                          inputMode="decimal"
                          min={0}
                          max={item.returnable}
                          step="any"
                          value={current || ""}
                          placeholder="0"
                          aria-label={t("returns.qtyFor", { name: item.productName })}
                          onChange={(e) => setQuantity(item.productId, Number(e.target.value) || 0, item.returnable)}
                          className="h-9 w-14 rounded-lg border border-border bg-surface text-center text-sm font-semibold tabular-nums text-text outline-none focus:border-primary"
                        />
                        <button
                          type="button"
                          aria-label={t("returns.more")}
                          onClick={() => setQuantity(item.productId, current + step, item.returnable)}
                          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-icon outline-none hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-primary/40"
                        >
                          <Plus size={14} aria-hidden="true" />
                        </button>
                      </div>
                    ) : (
                      <span className="shrink-0 text-xs font-semibold text-text-muted">{t("returns.allBack")}</span>
                    )}
                  </div>
                  {item.serials.length > 0 && current > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {item.serials.map((serial) => {
                        const picked = serials[item.productId]?.includes(serial) ?? false;
                        return (
                          <button
                            key={serial}
                            type="button"
                            aria-pressed={picked}
                            onClick={() =>
                              setSerials((m) => ({
                                ...m,
                                [item.productId]: picked
                                  ? (m[item.productId] ?? []).filter((x) => x !== serial)
                                  : [...(m[item.productId] ?? []), serial],
                              }))
                            }
                            className={clsx(
                              "rounded-md border px-2 py-1 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                              picked ? "border-text bg-text text-surface" : "border-border text-text"
                            )}
                          >
                            {serial}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={300}
            placeholder={t("returns.reasonPlaceholder")}
            aria-label={t("returns.reasonPlaceholder")}
            className="mt-4 h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm text-text outline-none focus:border-primary"
          />

          {value > 0 ? (
            <div className="mt-4 space-y-1 rounded-xl bg-surface-muted px-3.5 py-3 text-sm tabular-nums">
              <div className="flex justify-between font-semibold text-text">
                <span>{t("returns.value")}</span>
                <span>{formatMoney(value)}</span>
              </div>
              {adjusted > 0 ? (
                <div className="flex justify-between text-text-muted">
                  <span>{t("returns.offDue")}</span>
                  <span>{formatMoney(adjusted)}</span>
                </div>
              ) : null}
              {refund > 0 ? (
                <div className="flex justify-between font-semibold text-text">
                  <span>{t("returns.giveBack")}</span>
                  <span>{formatMoney(refund)}</span>
                </div>
              ) : null}
            </div>
          ) : null}

          {refund > 0 ? (
            <div className="mt-3">
              <p className="text-sm font-semibold text-text">{t("returns.refundBy")}</p>
              <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                {refundMethods.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    aria-pressed={refundMethod === m.value}
                    onClick={() => setRefundMethod(m.value)}
                    className={clsx(
                      "min-h-10 rounded-lg border text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                      refundMethod === m.value ? "border-text bg-text text-surface" : "border-border text-text hover:bg-surface-muted"
                    )}
                  >
                    {t(`sales.newSaleModal.methodLabel.${m.labelKey}`)}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {serialProblem ? <p className="mt-2 text-xs font-semibold text-warning">{t("returns.pickImeis")}</p> : null}
        </div>

        <div className="flex gap-3 border-t border-border bg-surface-muted px-5 py-3.5">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button className="flex-1" disabled={chosen.length === 0 || serialProblem} isLoading={mutation.isPending} onClick={() => mutation.mutate()}>
            {t("returns.save")}
          </Button>
        </div>
      </div>
    </div>
  );
}
