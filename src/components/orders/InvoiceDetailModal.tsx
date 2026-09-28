import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Phone, Wallet, X } from "lucide-react";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { formatCurrency } from "../../lib/format";
import { recordPayment, type Invoice, type PaymentMethod } from "../../lib/invoices-api";
import { ApiError } from "../../lib/api";

function customerName(invoice: Invoice): string {
  return typeof invoice.customerId === "string" ? "Unknown customer" : invoice.customerId.name;
}

function customerPhone(invoice: Invoice): string | undefined {
  return typeof invoice.customerId === "string" ? undefined : invoice.customerId.phone;
}

const paymentStatusTone = {
  unpaid: "danger",
  partial: "warning",
  paid: "success",
} as const;

const paymentStatusLabel: Record<Invoice["paymentStatus"], string> = {
  unpaid: "Unpaid",
  partial: "Partially Paid",
  paid: "Paid",
};

const methodOptions: { value: PaymentMethod; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "upi", label: "UPI" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "cheque", label: "Cheque" },
  { value: "credit", label: "Credit" },
  { value: "other", label: "Other" },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function InvoiceDetailModal({ invoice, onClose }: { invoice: Invoice | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const paymentMutation = useMutation({
    mutationFn: (input: { amount: number; method: PaymentMethod; note?: string }) =>
      recordPayment(invoice!._id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      setAmount("");
      setNote("");
      setError(null);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Couldn't record payment. Please try again."),
  });

  if (!invoice) return null;

  const remaining = Math.max(0, invoice.totalAmount - invoice.amountPaid);
  const canRecord = invoice.paymentStatus !== "paid" && Number(amount) > 0 && Number(amount) <= remaining + 0.01;

  const handleRecord = () => {
    setError(null);
    paymentMutation.mutate({ amount: Number(amount), method, note: note.trim() || undefined });
  };

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/40 p-4">
      <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl bg-surface shadow-elevation-3">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
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
            {customerName(invoice)} · {invoice.billType === "gst" ? "GST Bill" : "Record Bill"} · {formatDate(invoice.createdAt)}
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
                    {invoice.billType === "gst" && item.gstPercent > 0 ? ` · GST ${item.gstPercent}%` : ""}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-semibold text-text">{formatCurrency(item.lineTotal)}</span>
              </div>
            ))}
          </div>

          <div className="mt-4 space-y-1.5 rounded-lg bg-surface-variant px-3.5 py-3">
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">Subtotal</span>
              <span className="text-text">{formatCurrency(invoice.subtotal)}</span>
            </div>
            {invoice.billType === "gst" ? (
              <div className="flex justify-between text-sm">
                <span className="text-text-muted">Tax</span>
                <span className="text-text">{formatCurrency(invoice.taxTotal)}</span>
              </div>
            ) : null}
            <div className="flex justify-between border-t border-border pt-1.5 text-sm font-semibold">
              <span className="text-text">Total</span>
              <span className="text-text">{formatCurrency(invoice.totalAmount)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">Paid</span>
              <span className="text-success">{formatCurrency(invoice.amountPaid)}</span>
            </div>
            <div className="flex justify-between text-sm font-semibold">
              <span className="text-text-muted">Remaining</span>
              <span className={remaining > 0 ? "text-danger" : "text-text"}>{formatCurrency(remaining)}</span>
            </div>
          </div>

          {invoice.payments.length > 0 ? (
            <div className="mt-4">
              <p className="mb-2 text-sm font-medium text-text-muted">Payment history</p>
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
            <div className="mt-5 rounded-xl border border-border p-4">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-text">
                <Wallet size={15} /> Record a payment
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-xs text-text-muted">Amount</label>
                  <input
                    type="number"
                    min={0.01}
                    max={remaining}
                    step="any"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder={`Up to ${formatCurrency(remaining)}`}
                    className="mt-0.5 w-full rounded-lg border border-transparent bg-surface-variant px-3 py-2 text-sm text-text outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-xs text-text-muted">Method</label>
                  <select
                    value={method}
                    onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                    className="mt-0.5 w-full rounded-lg border border-transparent bg-surface-variant px-3 py-2 text-sm text-text outline-none focus:border-primary"
                  >
                    {methodOptions.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Note (optional)"
                className="mt-2.5 w-full rounded-lg border border-transparent bg-surface-variant px-3 py-2 text-sm text-text outline-none focus:border-primary"
              />

              {error ? (
                <p className="mt-2.5 flex items-center gap-1.5 text-sm text-danger">
                  <AlertTriangle size={14} /> {error}
                </p>
              ) : null}

              <Button
                className="mt-3 w-full"
                disabled={!canRecord}
                isLoading={paymentMutation.isPending}
                onClick={handleRecord}
              >
                Record payment
              </Button>
            </div>
          ) : null}

          <div className="mt-5">
            <Button variant="secondary" className="w-full" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
