import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Phone, Wallet, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { TextField } from "../ui/TextField";
import { formatCurrency } from "../../lib/format";
import { recordPayment, type Invoice, type PaymentMethod } from "../../lib/invoices-api";
import { ApiError } from "../../lib/api";
import { showError } from "../../lib/toast";
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

export function InvoiceDetailModal({ invoice, onClose }: { invoice: Invoice | null; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const remaining = invoice ? Math.max(0, invoice.totalAmount - invoice.amountPaid) : 0;

  function customerName(invoice: Invoice): string {
    return typeof invoice.customerId === "string" ? t("orders.invoiceDetailModal.unknownCustomer") : invoice.customerId.name;
  }

  function customerPhone(invoice: Invoice): string | undefined {
    return typeof invoice.customerId === "string" ? undefined : invoice.customerId.phone;
  }

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
    formState: { errors, isSubmitting },
  } = useForm<PaymentFormInput, unknown, PaymentFormValues>({
    resolver: zodResolver(buildPaymentSchema(remaining)),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: { amount: undefined, method: "cash", note: "" },
  });

  useEffect(() => {
    reset({ amount: undefined, method: "cash", note: "" });
  }, [invoice?._id, reset]);

  useEffect(() => {
    trigger("amount");
  }, [remaining, trigger]);

  const paymentMutation = useMutation({
    mutationFn: (input: { amount: number; method: PaymentMethod; note?: string }) =>
      recordPayment(invoice!._id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      reset({ amount: undefined, method: "cash", note: "" });
    },
    onError: (err) => showError(err instanceof ApiError ? err.message : t("orders.invoiceDetailModal.couldNotRecordPayment")),
  });

  if (!invoice) return null;

  const submit = (values: PaymentFormValues) => {
    paymentMutation.mutate({ amount: values.amount, method: values.method, note: values.note?.trim() || undefined });
  };

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/40 p-4">
      <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl bg-surface shadow-elevation-3">
        <button
          type="button"
          onClick={onClose}
          aria-label={t("orders.invoiceDetailModal.close")}
          className="absolute right-4 top-4 z-10 rounded-full p-1.5 text-text-muted outline-none transition-colors hover:bg-surface-muted hover:text-text focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <X size={18} />
        </button>

        <div className="overflow-y-auto p-6">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-text">{invoice.invoiceNumber}</h2>
            <Badge tone={paymentStatusTone[invoice.paymentStatus]}>{paymentStatusLabel[invoice.paymentStatus]}</Badge>
          </div>
          <p className="mt-1 text-sm text-text-muted">
            {customerName(invoice)} · {invoice.billType === "gst" ? t("orders.invoiceDetailModal.billTypeGst") : t("orders.invoiceDetailModal.billTypeRecord")} · {formatDate(invoice.createdAt)}
          </p>
          {customerPhone(invoice) ? (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-text-muted">
              <Phone size={13} />
              {customerPhone(invoice)}
            </p>
          ) : null}

          <div className="mt-5 space-y-2">
            {invoice.items.map((item, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border border-border bg-surface px-3.5 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-text">{item.productName}</p>
                  <p className="text-xs text-text-muted">
                    {item.quantity} {item.unit} × {formatCurrency(item.unitPrice)}
                    {invoice.billType === "gst" && item.gstPercent > 0 ? t("orders.invoiceDetailModal.gstPercentSuffix", { percent: item.gstPercent }) : ""}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-semibold text-text">{formatCurrency(item.lineTotal)}</span>
              </div>
            ))}
          </div>

          <div className="mt-4 space-y-1.5 rounded-lg bg-surface-variant px-3.5 py-3">
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">{t("orders.invoiceDetailModal.subtotal")}</span>
              <span className="text-text">{formatCurrency(invoice.subtotal)}</span>
            </div>
            {invoice.billType === "gst" ? (
              <div className="flex justify-between text-sm">
                <span className="text-text-muted">{t("orders.invoiceDetailModal.tax")}</span>
                <span className="text-text">{formatCurrency(invoice.taxTotal)}</span>
              </div>
            ) : null}
            <div className="flex justify-between border-t border-border pt-1.5 text-sm font-semibold">
              <span className="text-text">{t("orders.invoiceDetailModal.total")}</span>
              <span className="text-text">{formatCurrency(invoice.totalAmount)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">{t("orders.invoiceDetailModal.paid")}</span>
              <span className="text-success">{formatCurrency(invoice.amountPaid)}</span>
            </div>
            <div className="flex justify-between text-sm font-semibold">
              <span className="text-text-muted">{t("orders.invoiceDetailModal.remaining")}</span>
              <span className={remaining > 0 ? "text-danger" : "text-text"}>{formatCurrency(remaining)}</span>
            </div>
          </div>

          {invoice.payments.length > 0 ? (
            <div className="mt-4">
              <p className="mb-2 text-sm font-medium text-text-muted">{t("orders.invoiceDetailModal.paymentHistory")}</p>
              <div className="space-y-2">
                {invoice.payments.map((p, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg border border-border bg-surface px-3.5 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-text">
                        {methodOptions.find((m) => m.value === p.method)?.label ?? p.method}
                      </p>
                      <p className="text-xs text-text-muted">
                        {formatDate(p.paidAt)}
                        {p.note ? ` · ${p.note}` : ""}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-success">{formatCurrency(p.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {invoice.paymentStatus !== "paid" ? (
            <form className="mt-5 rounded-xl border border-border p-4" onSubmit={handleSubmit(submit)} noValidate>
              <p className="flex items-center gap-1.5 text-sm font-semibold text-text">
                <Wallet size={15} /> {t("orders.invoiceDetailModal.recordAPayment")}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2.5">
                <TextField
                  label={t("orders.invoiceDetailModal.amount")}
                  type="number"
                  step="any"
                  placeholder={t("orders.invoiceDetailModal.upToAmount", { amount: formatCurrency(remaining) })}
                  error={errors.amount?.message}
                  {...register("amount")}
                />
                <div>
                  <label className="text-xs text-text-muted">{t("orders.invoiceDetailModal.method")}</label>
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

          <div className="mt-5">
            <Button variant="secondary" className="w-full" onClick={onClose}>
              {t("orders.invoiceDetailModal.close")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
