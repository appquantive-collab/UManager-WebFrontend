import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, Phone, Undo2, Wallet, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
import { TextField } from "../ui/TextField";
import { StatusPill } from "../page/kit";
import { BillActions } from "../bills/BillActions";
import { ReturnModal } from "./ReturnModal";
import { useAuthStore } from "../../lib/auth-store";
import { formatCurrency, formatMoney, formatQty } from "../../lib/format";
import { cancelBill, getInvoice, isCancelled, recordPayment, type Invoice, type PaymentMethod } from "../../lib/invoices-api";
import { billCustomerName, billCustomerPhone } from "../../lib/bill-share";
import { ApiError } from "../../lib/api";
import { showError, showSuccess } from "../../lib/toast";
import { errorMessage } from "../../lib/api-errors";
import i18n from "../../lib/i18n";

const paymentStatusTone = {
  unpaid: "danger",
  partial: "warning",
  paid: "success",
} as const;

const methodOptionKeys: { value: PaymentMethod; labelKey: string }[] = [
  { value: "cash", labelKey: "cash" },
  { value: "upi", labelKey: "upi" },
  { value: "bank_transfer", labelKey: "bankTransfer" },
  { value: "cheque", labelKey: "cheque" },
  { value: "credit", labelKey: "credit" },
  { value: "other", labelKey: "other" },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function buildPaymentSchema(remaining: number) {
  return z.object({
    amount: z.coerce
      .number()
      .positive(i18n.t("orders.invoiceDetailModal.amountMustBePositive"))
      .max(remaining + 0.01, i18n.t("orders.invoiceDetailModal.amountExceedsRemaining", { amount: formatCurrency(remaining) })),
    method: z.string().min(1) as z.ZodType<PaymentMethod>,
    note: z.string().optional(),
  });
}
type PaymentFormInput = z.input<ReturnType<typeof buildPaymentSchema>>;
type PaymentFormValues = z.output<ReturnType<typeof buildPaymentSchema>>;

export function InvoiceDetailModal({ invoice: initial, onClose }: { invoice: Invoice | null; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [returning, setReturning] = useState(false);
  const role = useAuthStore((st) => st.user?.role);
  const canCancel = role === "OWNER" || role === "MANAGER" || role === "SUPER_ADMIN";

  // Always show the latest copy (after a payment or cancel), starting from the row that was clicked.
  const invoiceQuery = useQuery({
    queryKey: ["invoices", "one", initial?._id],
    queryFn: () => getInvoice(initial!._id),
    enabled: Boolean(initial),
    initialData: initial ?? undefined,
  });
  const invoice = initial ? (invoiceQuery.data ?? initial) : null;
  const remaining = invoice ? Math.max(0, invoice.totalAmount - invoice.amountPaid) : 0;
  const cancelled = invoice ? isCancelled(invoice) : false;

  const paymentStatusLabel: Record<Invoice["paymentStatus"], string> = {
    unpaid: t("orders.invoiceDetailModal.paymentStatusLabel.unpaid"),
    partial: t("orders.invoiceDetailModal.paymentStatusLabel.partial"),
    paid: t("orders.invoiceDetailModal.paymentStatusLabel.paid"),
  };

  const methodOptions = methodOptionKeys.map((m) => ({
    value: m.value,
    label: t(`orders.invoiceDetailModal.methodLabel.${m.labelKey}`),
  }));

  const {
    register,
    handleSubmit,
    reset,
    trigger,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<PaymentFormInput, unknown, PaymentFormValues>({
    resolver: zodResolver(buildPaymentSchema(remaining)),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: { amount: undefined, method: "cash", note: "" },
  });

  useEffect(() => {
    reset({ amount: undefined, method: "cash", note: "" });
    setConfirmCancel(false);
    setCancelReason("");
  }, [initial?._id, reset]);

  useEffect(() => {
    trigger("amount");
  }, [remaining, trigger]);

  const refresh = (updated: Invoice) => {
    queryClient.setQueryData(["invoices", "one", updated._id], updated);
    queryClient.invalidateQueries({ queryKey: ["invoices"] });
    queryClient.invalidateQueries({ queryKey: ["customers"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const paymentMutation = useMutation({
    mutationFn: (input: { amount: number; method: PaymentMethod; note?: string }) => recordPayment(invoice!._id, input),
    onSuccess: (updated) => {
      refresh(updated);
      reset({ amount: undefined, method: "cash", note: "" });
    },
    onError: (err) => showError(err instanceof ApiError ? errorMessage(err, t) : t("orders.invoiceDetailModal.couldNotRecordPayment")),
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelBill(invoice!._id, cancelReason.trim() || undefined),
    onSuccess: (updated) => {
      refresh(updated);
      queryClient.invalidateQueries({ queryKey: ["stock-levels"] });
      queryClient.invalidateQueries({ queryKey: ["stock-level"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      setConfirmCancel(false);
      showSuccess(t("bill.cancelDone"));
    },
    onError: (err) => showError(err instanceof ApiError ? errorMessage(err, t) : t("bill.cancelFailed")),
  });

  if (!invoice) return null;

  const submit = (values: PaymentFormValues) => {
    paymentMutation.mutate({ amount: values.amount, method: values.method, note: values.note?.trim() || undefined });
  };
  const customerName = billCustomerName(invoice) || t("bill.walkIn");
  const phone = billCustomerPhone(invoice);
  const taxLines = invoice.isInterState
    ? [{ label: t("bill.igst"), value: invoice.igstTotal ?? invoice.taxTotal }]
    : [
        { label: t("bill.cgst"), value: invoice.cgstTotal ?? invoice.taxTotal / 2 },
        { label: t("bill.sgst"), value: invoice.sgstTotal ?? invoice.taxTotal / 2 },
      ];

  return (
    <div className="fixed inset-0 z-100 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={invoice.invoiceNumber}>
      <button type="button" aria-label={t("orders.invoiceDetailModal.close")} className="absolute inset-0 cursor-default" onClick={onClose} />
      <div className="relative z-10 flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-surface shadow-elevation-3 sm:rounded-3xl">
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold text-text">{invoice.invoiceNumber}</h2>
              {cancelled ? (
                <StatusPill tone="neutral">{t("bill.cancelled")}</StatusPill>
              ) : (
                <StatusPill tone={paymentStatusTone[invoice.paymentStatus]}>{paymentStatusLabel[invoice.paymentStatus]}</StatusPill>
              )}
            </div>
            <p className="mt-0.5 text-sm text-text-muted">
              {customerName} · {invoice.billType === "gst" ? t("orders.invoiceDetailModal.billTypeGst") : t("orders.invoiceDetailModal.billTypeRecord")} · {formatDate(invoice.createdAt)}
            </p>
            {phone ? (
              <p className="mt-0.5 flex items-center gap-1.5 text-sm text-text-muted">
                <Phone size={13} className="text-icon" aria-hidden="true" />
                {phone}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("orders.invoiceDetailModal.close")}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-text-muted outline-none transition-colors hover:bg-surface-muted hover:text-text focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {cancelled ? (
            <div className="mb-4 rounded-xl border border-border bg-surface-muted px-3.5 py-3 text-sm text-text">
              <p className="font-semibold">{t("bill.cancelledOn", { date: formatDate(invoice.cancelledAt ?? invoice.createdAt) })}</p>
              <p className="mt-0.5 text-text-muted">{invoice.cancelReason ? invoice.cancelReason : t("bill.cancelledNote")}</p>
            </div>
          ) : null}

          <BillActions invoice={invoice} />
          {!cancelled ? (
            <button
              type="button"
              onClick={() => setReturning(true)}
              className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-border px-3 text-sm font-semibold text-text outline-none hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <Undo2 size={16} className="text-icon" aria-hidden="true" /> {t("returns.button")}
            </button>
          ) : null}

          <div className="mt-4 divide-y divide-border rounded-xl border border-border">
            {invoice.items.map((item, i) => (
              <div key={i} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-text">{item.productName}</p>
                  <p className="text-xs text-text-muted">
                    {formatQty(item.quantity)} {item.unit} × {formatMoney(item.unitPrice)}
                    {(item.discountPercent ?? 0) > 0 ? ` · ${t("bill.discShort", { percent: item.discountPercent })}` : ""}
                    {invoice.billType === "gst" && item.gstPercent > 0 ? t("orders.invoiceDetailModal.gstPercentSuffix", { percent: item.gstPercent }) : ""}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-text">{formatMoney(item.lineTotal)}</span>
              </div>
            ))}
          </div>

          <div className="mt-4 space-y-1.5 rounded-xl bg-surface-muted px-3.5 py-3 text-sm tabular-nums">
            <div className="flex justify-between">
              <span className="text-text-muted">{t("orders.invoiceDetailModal.subtotal")}</span>
              <span className="text-text">{formatMoney(invoice.subtotal)}</span>
            </div>
            {(invoice.discountTotal ?? 0) > 0 ? (
              <div className="flex justify-between">
                <span className="text-text-muted">{t("bill.discountIncluded")}</span>
                <span className="text-text">− {formatMoney(invoice.discountTotal ?? 0)}</span>
              </div>
            ) : null}
            {invoice.billType === "gst"
              ? taxLines.map((line) => (
                  <div key={line.label} className="flex justify-between">
                    <span className="text-text-muted">{line.label}</span>
                    <span className="text-text">{formatMoney(line.value)}</span>
                  </div>
                ))
              : null}
            {(invoice.roundOff ?? 0) !== 0 ? (
              <div className="flex justify-between">
                <span className="text-text-muted">{t("bill.roundOff")}</span>
                <span className="text-text">{formatMoney(invoice.roundOff ?? 0)}</span>
              </div>
            ) : null}
            <div className="flex justify-between border-t border-border pt-1.5 font-semibold">
              <span className="text-text">{t("orders.invoiceDetailModal.total")}</span>
              <span className="text-text">{formatMoney(invoice.totalAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">{t("orders.invoiceDetailModal.paid")}</span>
              <span className="text-success">{formatMoney(invoice.amountPaid)}</span>
            </div>
            {!cancelled ? (
              <div className="flex justify-between font-semibold">
                <span className="text-text-muted">{t("orders.invoiceDetailModal.remaining")}</span>
                <span className={remaining > 0 ? "text-danger" : "text-text"}>{formatMoney(remaining)}</span>
              </div>
            ) : null}
          </div>

          {invoice.payments.length > 0 ? (
            <div className="mt-4">
              <p className="mb-2 text-sm font-semibold text-text">{t("orders.invoiceDetailModal.paymentHistory")}</p>
              <div className="divide-y divide-border rounded-xl border border-border">
                {invoice.payments.map((p, i) => (
                  <div key={i} className="flex items-center justify-between px-3.5 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-text">
                        {p.method === "credit_note" ? t("bill.creditNote") : (methodOptions.find((m) => m.value === p.method)?.label ?? p.method)}
                      </p>
                      <p className="text-xs text-text-muted">
                        {formatDate(p.paidAt)}
                        {p.note ? ` · ${p.note}` : ""}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-success">{formatMoney(p.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {!cancelled && invoice.paymentStatus !== "paid" ? (
            <form className="mt-5 rounded-xl border border-border p-4" onSubmit={handleSubmit(submit)} noValidate>
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-text">
                  <Wallet size={15} className="text-icon" aria-hidden="true" /> {t("orders.invoiceDetailModal.recordAPayment")}
                </p>
                <button
                  type="button"
                  className="rounded-lg px-2 py-1 text-xs font-semibold text-primary outline-none hover:bg-primary-container focus-visible:ring-2 focus-visible:ring-primary/40"
                  onClick={() => setValue("amount", remaining, { shouldValidate: true })}
                >
                  {t("bill.fullAmount", { amount: formatCurrency(remaining) })}
                </button>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2.5">
                <TextField
                  label={t("orders.invoiceDetailModal.amount")}
                  type="number"
                  step="any"
                  inputMode="decimal"
                  placeholder={t("orders.invoiceDetailModal.upToAmount", { amount: formatCurrency(remaining) })}
                  error={errors.amount?.message}
                  {...register("amount")}
                />
                <div>
                  <label className="text-xs text-text">{t("orders.invoiceDetailModal.method")}</label>
                  <select
                    className="mt-0.5 w-full rounded-lg border border-transparent bg-surface-variant px-3 py-2 text-sm text-text outline-none focus:border-primary"
                    {...register("method")}
                  >
                    {methodOptions.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mt-2.5">
                <TextField label={t("orders.invoiceDetailModal.noteOptional")} {...register("note")} />
              </div>

              <Button type="submit" className="mt-3 w-full" isLoading={isSubmitting || paymentMutation.isPending}>
                {t("orders.invoiceDetailModal.recordPayment")}
              </Button>
            </form>
          ) : null}

          {!cancelled && canCancel ? (
            <div className="mt-5">
              {!confirmCancel ? (
                <button
                  type="button"
                  onClick={() => setConfirmCancel(true)}
                  className="flex items-center gap-1.5 text-sm font-semibold text-danger outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  <Ban size={14} aria-hidden="true" /> {t("bill.cancelBill")}
                </button>
              ) : invoice.amountPaid > 0 && (billCustomerName(invoice) !== "Walk-in customer" || invoice.payments.some((p) => p.method === "credit_note")) ? (
                <div className="rounded-xl border border-border px-3.5 py-3 text-sm text-text">
                  <p className="font-semibold">{t("bill.cantCancelPaidTitle")}</p>
                  <p className="mt-0.5 text-text-muted">{t("bill.cantCancelPaidBody")}</p>
                  <Button variant="secondary" className="mt-3" onClick={() => setConfirmCancel(false)}>
                    {t("bill.ok")}
                  </Button>
                </div>
              ) : (
                <div className="rounded-xl border border-danger/40 px-3.5 py-3">
                  <p className="text-sm font-semibold text-text">{t("bill.cancelConfirmTitle")}</p>
                  <p className="mt-0.5 text-sm text-text-muted">{t("bill.cancelConfirmBody")}</p>
                  <input
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder={t("bill.cancelReasonPlaceholder")}
                    maxLength={300}
                    className="mt-3 h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm text-text outline-none focus:border-primary"
                  />
                  <div className="mt-3 flex gap-2">
                    <Button variant="secondary" className="flex-1" onClick={() => setConfirmCancel(false)}>
                      {t("bill.keepBill")}
                    </Button>
                    <Button variant="danger" className="flex-1" isLoading={cancelMutation.isPending} onClick={() => cancelMutation.mutate()}>
                      {t("bill.yesCancel")}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
      <ReturnModal invoice={invoice} open={returning} onClose={() => setReturning(false)} />
    </div>
  );
}
