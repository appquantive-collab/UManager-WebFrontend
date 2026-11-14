import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { CalendarDays, IdCard, Mail, MapPin, Pencil, Phone, Plus, Receipt, FileText, Wallet, X } from "lucide-react";
import { Avatar } from "../ui/Avatar";
import { Badge } from "../ui/Badge";
import { Tabs } from "../ui/Tabs";
import { formatCurrency } from "../../lib/format";
import { getCustomerPortfolio } from "../../lib/customers-api";
import { getOrder, type Order } from "../../lib/orders-api";
import { getInvoice, type Invoice } from "../../lib/invoices-api";
import { OrderDetailModal } from "../orders/OrderDetailModal";
import { InvoiceDetailModal } from "../orders/InvoiceDetailModal";
import { AddCustomerModal } from "./AddCustomerModal";
import { stateName } from "../../lib/gst-states";

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

export function PartyPortfolioModal({ customerId, onClose }: { customerId: string | null; onClose: () => void }) {
  const { t } = useTranslation();
  const tabs = [
    { key: "orders", label: t("customers.partyPortfolioModal.tabs.orders") },
    { key: "invoices", label: t("customers.partyPortfolioModal.tabs.invoices") },
    { key: "payments", label: t("customers.partyPortfolioModal.tabs.payments") },
  ];
  const [tab, setTab] = useState("orders");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [editing, setEditing] = useState(false);

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
      <button type="button" aria-label={t("common.close")} className="absolute inset-0 cursor-default" onClick={onClose} />
      <div className="relative z-10 flex h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-surface shadow-elevation-3 lg:h-auto lg:max-h-[85vh] lg:max-w-2xl lg:rounded-2xl">
        <button
          type="button"
          onClick={onClose}
          aria-label={t("common.close")}
          className="absolute right-4 top-4 z-10 rounded-full bg-surface/80 p-1.5 text-text-muted outline-none transition-colors hover:bg-surface-muted hover:text-text focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <X size={18} />
        </button>

        {query.isLoading ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-sm text-text-muted">{t("customers.partyPortfolioModal.loading")}</p>
          </div>
        ) : !data ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-sm text-text-muted">{t("customers.partyPortfolioModal.loadError")}</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <div className="border-b border-border bg-surface-muted/40 p-6">
              <div className="flex items-center gap-4">
                <Avatar name={data.customer.name} size={56} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 pr-8">
                    <h2 className="truncate text-lg font-bold text-text">{data.customer.name}</h2>
                    {!data.customer.isWalkIn ? (
                      <button
                        type="button"
                        onClick={() => setEditing(true)}
                        aria-label={t("customers.addCustomerModal.editTitle")}
                        title={t("customers.addCustomerModal.editTitle")}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-icon outline-none hover:bg-surface-muted hover:text-text focus-visible:ring-2 focus-visible:ring-primary/40"
                      >
                        <Pencil size={15} aria-hidden="true" />
                      </button>
                    ) : null}
                  </div>
                  {/* Kind of party and how long they've been a customer. */}
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-text-muted">
                    {!data.customer.isWalkIn ? (
                      <Badge tone="neutral">{t(`customerForm.kind.${data.customer.kind ?? "person"}`)}</Badge>
                    ) : null}
                    <span className="flex items-center gap-1">
                      <CalendarDays size={13} className="shrink-0 text-icon" aria-hidden="true" />
                      {t("customers.partyPortfolioModal.customerSince", { date: formatDate(data.customer.createdAt) })}
                    </span>
                  </p>
                  {!data.customer.isActive ? (
                    <span className="mt-1 inline-block">
                      <Badge tone="neutral">{t("customers.partyPortfolioModal.inactive")}</Badge>
                    </span>
                  ) : null}
                </div>
              </div>

              {/* Every detail saved for this party; missing ones are one tap away. */}
              {!data.customer.isWalkIn ? (
                <div className="mt-4 divide-y divide-border rounded-xl border border-border bg-surface text-sm">
                  {[
                    data.customer.phone
                      ? {
                          key: "phone",
                          icon: Phone,
                          label: t("customers.partyPortfolioModal.details.phone"),
                          value: (
                            <a href={`tel:${data.customer.phone}`} className="font-medium text-text hover:text-primary hover:underline">
                              {data.customer.phone}
                            </a>
                          ),
                        }
                      : null,
                    data.customer.email
                      ? {
                          key: "email",
                          icon: Mail,
                          label: t("customers.partyPortfolioModal.details.email"),
                          value: (
                            <a href={`mailto:${data.customer.email}`} className="break-all font-medium text-text hover:text-primary hover:underline">
                              {data.customer.email}
                            </a>
                          ),
                        }
                      : null,
                    data.customer.address || data.customer.stateCode
                      ? {
                          key: "address",
                          icon: MapPin,
                          label: t("customers.partyPortfolioModal.details.address"),
                          value: <span className="font-medium text-text">{[data.customer.address, stateName(data.customer.stateCode)].filter(Boolean).join(", ")}</span>,
                        }
                      : null,
                    data.customer.gstin
                      ? {
                          key: "gstin",
                          icon: FileText,
                          label: "GSTIN",
                          value: <span className="font-medium tabular-nums tracking-wide text-text">{data.customer.gstin}</span>,
                        }
                      : null,
                    data.customer.aadhaarLast4
                      ? {
                          key: "aadhaar",
                          icon: IdCard,
                          label: t("customers.partyPortfolioModal.details.aadhaar"),
                          value: <span className="font-medium tabular-nums tracking-wide text-text">•••• •••• {data.customer.aadhaarLast4}</span>,
                        }
                      : null,
                  ]
                    .filter((row): row is NonNullable<typeof row> => row !== null)
                    .map((row) => (
                      <div key={row.key} className="flex items-start gap-3 px-3.5 py-2.5">
                        <row.icon size={15} className="mt-0.5 shrink-0 text-icon" aria-hidden="true" />
                        <span className="w-20 shrink-0 text-text-muted">{row.label}</span>
                        <span className="min-w-0 flex-1">{row.value}</span>
                      </div>
                    ))}
                  {!data.customer.phone || !data.customer.address || !(data.customer.gstin || data.customer.aadhaarLast4) ? (
                    <button
                      type="button"
                      onClick={() => setEditing(true)}
                      className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left font-semibold text-primary outline-none hover:bg-surface-muted focus-visible:bg-surface-muted"
                    >
                      <Plus size={15} aria-hidden="true" />
                      {t("customers.partyPortfolioModal.details.addMissing")}
                    </button>
                  ) : null}
                </div>
              ) : null}

              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-border bg-surface p-3">
                  <p className="text-xs text-text-muted">{t("customers.customersPage.totalPurchases")}</p>
                  <p className="mt-1 text-base font-bold text-text">{formatCurrency(data.stats.totalPurchases)}</p>
                </div>
                <div className="rounded-xl border border-border bg-surface p-3">
                  <p className="text-xs text-text-muted">{t("customers.customersPage.outstanding")}</p>
                  <p className={`mt-1 text-base font-bold ${data.stats.outstanding > 0 ? "text-danger" : "text-text"}`}>
                    {formatCurrency(data.stats.outstanding)}
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-surface p-3">
                  <p className="text-xs text-text-muted">{t("customers.customersPage.creditLimit")}</p>
                  <p className="mt-1 text-base font-bold text-text">
                    {data.customer.creditLimit > 0 ? formatCurrency(data.customer.creditLimit) : t("customerForm.noLimit")}
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-surface p-3">
                  <p className="text-xs text-text-muted">{t("customers.partyPortfolioModal.pendingOrders")}</p>
                  <p className="mt-1 text-base font-bold text-text">{data.stats.pendingOrders}</p>
                </div>
              </div>
            </div>

            <div className="p-6">
              <Tabs tabs={tabs} active={tab} onChange={setTab} />

              <div className="mt-4 space-y-2.5">
                {tab === "orders" &&
                  (data.orders.length === 0 ? (
                    <EmptyRow icon={Receipt} label={t("customers.partyPortfolioModal.noOrders")} />
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
                            {o.itemCount === 1
                              ? t("customers.partyPortfolioModal.itemCountOne", { count: o.itemCount })
                              : t("customers.partyPortfolioModal.itemCountMany", { count: o.itemCount })}{" "}
                            · {o.source === "ai_parsed" ? t("customers.partyPortfolioModal.aiOrder") : t("customers.partyPortfolioModal.manualOrder")}
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
                    <EmptyRow icon={FileText} label={t("customers.partyPortfolioModal.noInvoices")} />
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
                            {inv.billType === "gst" ? t("customers.partyPortfolioModal.gstBill") : t("customers.partyPortfolioModal.recordBill")} · {formatDate(inv.createdAt)}
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
                    <EmptyRow icon={Wallet} label={t("customers.partyPortfolioModal.noPayments")} />
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
      <AddCustomerModal open={editing} onClose={() => setEditing(false)} customer={data?.customer ?? null} />
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
