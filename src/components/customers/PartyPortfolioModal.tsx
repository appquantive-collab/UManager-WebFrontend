import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Phone, Receipt, FileText, Wallet, X } from "lucide-react";
import { Avatar } from "../ui/Avatar";
import { Badge } from "../ui/Badge";
import { Tabs } from "../ui/Tabs";
import { formatCurrency } from "../../lib/format";
import { getCustomerPortfolio } from "../../lib/customers-api";
import { getOrder, type Order } from "../../lib/orders-api";
import { getInvoice, type Invoice } from "../../lib/invoices-api";
import { OrderDetailModal } from "../orders/OrderDetailModal";
import { InvoiceDetailModal } from "../orders/InvoiceDetailModal";

const orderStatusTone: Record<string, "warning" | "info" | "success" | "danger" | "neutral"> = {
  pending: "warning",
  confirmed: "info",
  delivered: "success",
  cancelled: "danger",
};

const paymentStatusTone: Record<string, "danger" | "warning" | "success" | "neutral"> = {
  unpaid: "danger",
  partial: "warning",
  paid: "success",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

const tabs = [
  { key: "orders", label: "Orders" },
  { key: "invoices", label: "Invoices" },
  { key: "payments", label: "Payments" },
];

export function PartyPortfolioModal({ customerId, onClose }: { customerId: string | null; onClose: () => void }) {
  const [tab, setTab] = useState("orders");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  const query = useQuery({
    queryKey: ["customer-portfolio", customerId],
    queryFn: () => getCustomerPortfolio(customerId!),
    enabled: !!customerId,
  });

  const openOrder = async (id: string) => setSelectedOrder(await getOrder(id));
  const openInvoice = async (id: string) => setSelectedInvoice(await getInvoice(id));

  if (!customerId) return null;

  const data = query.data;

  return (
    <div className="fixed inset-0 z-100 flex items-end justify-center bg-black/40 lg:items-center lg:p-4">
      <button type="button" aria-label="Close" className="absolute inset-0 cursor-default" onClick={onClose} />
      <div className="relative z-10 flex h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-surface shadow-elevation-3 lg:h-auto lg:max-h-[85vh] lg:max-w-2xl lg:rounded-2xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 z-10 rounded-full bg-surface/80 p-1.5 text-text-muted outline-none transition-colors hover:bg-surface-muted hover:text-text focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <X size={18} />
        </button>

        {query.isLoading ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-sm text-text-muted">Loading party portfolio…</p>
          </div>
        ) : !data ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-sm text-text-muted">Could not load this customer.</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <div className="border-b border-border bg-surface-muted/40 p-6">
              <div className="flex items-center gap-4">
                <Avatar name={data.customer.name} size={56} />
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-bold text-text">{data.customer.name}</h2>
                  {data.customer.phone ? (
                    <p className="mt-0.5 flex items-center gap-1.5 text-sm text-text-muted">
                      <Phone size={13} />
                      {data.customer.phone}
                    </p>
                  ) : null}
                  {!data.customer.isActive ? (
                    <span className="mt-1 inline-block">
                      <Badge tone="neutral">Inactive</Badge>
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-border bg-surface p-3">
                  <p className="text-xs text-text-muted">Total Purchases</p>
                  <p className="mt-1 text-base font-bold text-text">{formatCurrency(data.stats.totalPurchases)}</p>
                </div>
                <div className="rounded-xl border border-border bg-surface p-3">
                  <p className="text-xs text-text-muted">Outstanding</p>
                  <p className={`mt-1 text-base font-bold ${data.stats.outstanding > 0 ? "text-danger" : "text-text"}`}>
                    {formatCurrency(data.stats.outstanding)}
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-surface p-3">
                  <p className="text-xs text-text-muted">Credit Limit</p>
                  <p className="mt-1 text-base font-bold text-text">{formatCurrency(data.customer.creditLimit)}</p>
                </div>
                <div className="rounded-xl border border-border bg-surface p-3">
                  <p className="text-xs text-text-muted">Pending Orders</p>
                  <p className="mt-1 text-base font-bold text-text">{data.stats.pendingOrders}</p>
                </div>
              </div>
            </div>

            <div className="p-6">
              <Tabs tabs={tabs} active={tab} onChange={setTab} />

              <div className="mt-4 space-y-2.5">
                {tab === "orders" &&
                  (data.orders.length === 0 ? (
                    <EmptyRow icon={Receipt} label="No orders from this customer yet." />
                  ) : (
                    data.orders.map((o) => (
                      <button
                        key={o._id}
                        type="button"
                        onClick={() => openOrder(o._id)}
                        className="flex w-full items-center justify-between rounded-xl border border-border bg-surface p-3.5 text-left outline-none transition-shadow hover:shadow-elevation-1 focus-visible:ring-2 focus-visible:ring-primary/40"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-text">
                            {o.itemCount} item{o.itemCount === 1 ? "" : "s"} · {o.source === "ai_parsed" ? "AI Order" : "Manual"}
                          </p>
                          <p className="mt-0.5 text-xs text-text-muted">{formatDate(o.createdAt)}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                          <span className="text-sm font-semibold text-text">{formatCurrency(o.totalAmount)}</span>
                          <Badge tone={orderStatusTone[o.status] ?? "neutral"}>
                            {o.status.charAt(0).toUpperCase() + o.status.slice(1)}
                          </Badge>
                        </div>
                      </button>
                    ))
                  ))}

                {tab === "invoices" &&
                  (data.invoices.length === 0 ? (
                    <EmptyRow icon={FileText} label="No invoices generated for this customer yet." />
                  ) : (
                    data.invoices.map((inv) => (
                      <button
                        key={inv._id}
                        type="button"
                        onClick={() => openInvoice(inv._id)}
                        className="flex w-full items-center justify-between rounded-xl border border-border bg-surface p-3.5 text-left outline-none transition-shadow hover:shadow-elevation-1 focus-visible:ring-2 focus-visible:ring-primary/40"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-text">{inv.invoiceNumber}</p>
                          <p className="mt-0.5 text-xs text-text-muted">
                            {inv.billType === "gst" ? "GST Bill" : "Record Bill"} · {formatDate(inv.createdAt)}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                          <span className="text-sm font-semibold text-text">{formatCurrency(inv.totalAmount)}</span>
                          <Badge tone={paymentStatusTone[inv.paymentStatus] ?? "neutral"}>
                            {inv.paymentStatus.charAt(0).toUpperCase() + inv.paymentStatus.slice(1)}
                          </Badge>
                        </div>
                      </button>
                    ))
                  ))}

                {tab === "payments" &&
                  (data.payments.length === 0 ? (
                    <EmptyRow icon={Wallet} label="No payments recorded for this customer yet." />
                  ) : (
                    data.payments.map((p, i) => (
                      <div
                        key={`${p.invoiceId}-${i}`}
                        className="flex items-center justify-between rounded-xl border border-border bg-surface p-3.5"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-text">
                            {p.invoiceNumber} · {p.method.replace("_", " ")}
                          </p>
                          <p className="mt-0.5 text-xs text-text-muted">
                            {formatDate(p.paidAt)}
                            {p.note ? ` · ${p.note}` : ""}
                          </p>
                        </div>
                        <span className="shrink-0 text-sm font-semibold text-success">{formatCurrency(p.amount)}</span>
                      </div>
                    ))
                  ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <OrderDetailModal order={selectedOrder} onClose={() => setSelectedOrder(null)} />
      <InvoiceDetailModal invoice={selectedInvoice} onClose={() => setSelectedInvoice(null)} />
    </div>
  );
}

function EmptyRow({ icon: Icon, label }: { icon: typeof Receipt; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-surface py-10 text-center">
      <Icon size={20} className="text-text-muted" strokeWidth={1.5} />
      <p className="mt-2 text-sm text-text-muted">{label}</p>
    </div>
  );
}
