import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { FileText, Receipt, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SearchInput } from "../../components/ui/SearchInput";
import { SalesGuide } from "../../components/sales/SalesGuide";
import { Badge } from "../../components/ui/Badge";
import { formatCurrency } from "../../lib/format";
import { listOrders, type Order } from "../../lib/orders-api";
import { isArchived, isCancelled, listInvoices, type Invoice } from "../../lib/invoices-api";
import { OrderDetailModal } from "../../components/orders/OrderDetailModal";
import { InvoiceDetailModal } from "../../components/orders/InvoiceDetailModal";
import { initialParam } from "../../lib/url-params";

type FilterKey = "all" | "pending" | "delivered" | "cancelled";

const paymentStatusTone = {
  unpaid: "danger",
  partial: "warning",
  paid: "success",
} as const;

export function MobileSalesOrders({
  onNewOrder,
  onNewSale,
}: {
  onNewOrder?: () => void;
  onNewSale?: () => void;
}) {
  const { t } = useTranslation();
  const [tab, setTab] = useState(() => (initialParam("tab") === "bills" ? "invoices" : "orders"));

  const salesTabs = [
    { key: "orders", label: t("sales.mobileSalesOrders.tabs.orders"), icon: Receipt },
    { key: "invoices", label: t("sales.mobileSalesOrders.tabs.invoices"), icon: FileText },
  ];

  function customerName(entity: { customerId: { name: string } | string }): string {
    return typeof entity.customerId === "string" ? t("sales.mobileSalesOrders.unknownCustomer") : entity.customerId.name;
  }

  function timeAgo(iso: string): string {
    const diffMs = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return t("sales.mobileSalesOrders.justNow");
    if (mins < 60) return t("sales.mobileSalesOrders.minutesAgo", { count: mins });
    const hours = Math.floor(mins / 60);
    if (hours < 24) return t("sales.mobileSalesOrders.hoursAgo", { count: hours });
    const days = Math.floor(hours / 24);
    return t("sales.mobileSalesOrders.daysAgo", { count: days });
  }

  const orderStatusBadge: Record<Order["status"], { label: string; className: string }> = {
    pending: { label: t("sales.mobileSalesOrders.statusLabel.pending"), className: "bg-warning-container text-warning" },
    confirmed: { label: t("sales.mobileSalesOrders.statusLabel.confirmed"), className: "bg-info-container text-info" },
    delivered: { label: t("sales.mobileSalesOrders.statusLabel.delivered"), className: "bg-success-container text-success" },
    cancelled: { label: t("sales.mobileSalesOrders.statusLabel.cancelled"), className: "bg-danger text-white" },
  };

  const paymentStatusLabel: Record<Invoice["paymentStatus"], string> = {
    unpaid: t("sales.mobileSalesOrders.paymentStatusLabel.unpaid"),
    partial: t("sales.mobileSalesOrders.paymentStatusLabel.partial"),
    paid: t("sales.mobileSalesOrders.paymentStatusLabel.paid"),
  };
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState(() => initialParam("q"));
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const ordersQuery = useQuery({ queryKey: ["orders"], queryFn: () => listOrders() });
  const orders = ordersQuery.data ?? [];

  const invoicesQuery = useQuery({ queryKey: ["invoices"], queryFn: listInvoices, enabled: tab === "invoices" });
  const invoices = invoicesQuery.data ?? [];

  const filters = useMemo(() => {
    const pending = orders.filter((o) => o.status === "pending" || o.status === "confirmed").length;
    const delivered = orders.filter((o) => o.status === "delivered").length;
    const cancelled = orders.filter((o) => o.status === "cancelled").length;
    return [
      { key: "all" as const, label: t("sales.mobileSalesOrders.filterAllOrders"), count: orders.length },
      { key: "pending" as const, label: t("sales.mobileSalesOrders.filterPending"), count: pending },
      { key: "delivered" as const, label: t("sales.mobileSalesOrders.filterBilled"), count: delivered },
      { key: "cancelled" as const, label: t("sales.mobileSalesOrders.filterCancelled"), count: cancelled },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, t]);

  const filteredOrders = orders.filter((o) => {
    const matchesFilter =
      filter === "all" ||
      (filter === "pending" && (o.status === "pending" || o.status === "confirmed")) ||
      (filter === "delivered" && o.status === "delivered") ||
      (filter === "cancelled" && o.status === "cancelled");
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || customerName(o).toLowerCase().includes(query);
    return matchesFilter && matchesSearch;
  });

  const filteredInvoices = invoices.filter((inv) => {
    if (isArchived(inv) !== showArchived) return false;
    const query = search.trim().toLowerCase();
    return !query || customerName(inv).toLowerCase().includes(query) || inv.invoiceNumber.toLowerCase().includes(query);
  });

  const grossValue = orders.reduce((sum, o) => sum + o.totalAmount, 0);
  const avgTicket = orders.length > 0 ? grossValue / orders.length : 0;

  return (
    <div className="space-y-3">
      <SalesGuide onNewOrder={() => onNewOrder?.()} onNewSale={() => onNewSale?.()} />

      <div className="rounded-xl border border-border bg-surface-muted p-1">
        <div className="grid grid-cols-2 gap-1">
          {salesTabs.map((tabItem) => (
            <button
              key={tabItem.key}
              type="button"
              onClick={() => setTab(tabItem.key)}
              className={clsx(
                "flex items-center justify-center gap-1.5 rounded-lg py-2.5 font-label text-sm font-bold tracking-wide outline-none transition-all focus-visible:ring-2 focus-visible:ring-primary/40",
                tab === tabItem.key ? "bg-primary text-on-primary shadow-elevation-1" : "text-text-muted hover:text-text"
              )}
            >
              <tabItem.icon size={16} aria-hidden="true" />
              {tabItem.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "orders" && (
        <>
          <div className="rounded-xl border border-border bg-surface p-3 shadow-elevation-1">
            <div className="mb-2 flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-primary" />
              <span className="font-label text-xs font-semibold uppercase tracking-wider text-primary">
                {t("sales.mobileSalesOrders.orderSummary")}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1.5 text-center">
              <div className="rounded-lg border border-border bg-surface-muted p-2">
                <span className="block font-label text-xs text-text-muted">{t("sales.mobileSalesOrders.grossValue")}</span>
                <span className="mt-0.5 block font-label text-xs font-bold text-primary">
                  {formatCurrency(grossValue)}
                </span>
              </div>
              <div className="rounded-lg border border-border bg-surface-muted p-2">
                <span className="block font-label text-xs text-text-muted">{t("sales.mobileSalesOrders.orders")}</span>
                <span className="mt-0.5 block font-label text-[0.8125rem] font-bold text-text">{orders.length}</span>
              </div>
              <div className="rounded-lg border border-border bg-surface-muted p-2">
                <span className="block font-label text-xs text-text-muted">{t("sales.mobileSalesOrders.avgTicket")}</span>
                <span className="mt-0.5 block truncate font-label text-[0.8125rem] font-bold text-text">
                  {formatCurrency(avgTicket)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <SearchInput
              placeholder={t("sales.mobileSalesOrders.searchByCustomer")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <button
            type="button"
            onClick={onNewOrder}
            className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-primary/30 bg-primary-container/40 text-primary outline-none transition-colors hover:border-primary active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <Sparkles size={16} />
            <span className="font-label text-[0.75rem] font-bold uppercase tracking-wide">{t("sales.mobileSalesOrders.newOrderTypeOrPaste")}</span>
          </button>

          <div className="scrollbar-hide flex items-center gap-2 overflow-x-auto pb-1">
            {filters.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={clsx(
                  "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 font-label text-xs font-semibold outline-none transition-all focus-visible:ring-2 focus-visible:ring-primary/40",
                  filter === f.key
                    ? "bg-primary text-on-primary shadow-elevation-1"
                    : "border border-border bg-surface text-text-muted hover:text-text"
                )}
              >
                <span>{f.label}</span>
                <span
                  className={clsx(
                    "rounded-full px-1.5 py-px text-xs",
                    filter === f.key ? "bg-on-primary/20" : "text-text-muted"
                  )}
                >
                  {f.count}
                </span>
              </button>
            ))}
          </div>

          {ordersQuery.isLoading ? (
            <p className="py-8 text-center text-sm text-text-muted">{t("sales.mobileSalesOrders.loadingOrders")}</p>
          ) : filteredOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-surface py-12 text-center">
              <Receipt size={22} className="text-text-muted" strokeWidth={1.5} />
              <p className="mt-2 text-sm font-medium text-text">{t("sales.mobileSalesOrders.noOrdersFoundTitle")}</p>
              <p className="mt-0.5 text-xs text-text-muted">{t("sales.mobileSalesOrders.noOrdersFoundDescription")}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredOrders.map((order) => {
                const status = orderStatusBadge[order.status];
                return (
                  <button
                    key={order._id}
                    type="button"
                    onClick={() => setSelectedOrder(order)}
                    className="relative w-full overflow-hidden rounded-xl border border-border bg-surface text-left shadow-elevation-1 outline-none transition-shadow active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-primary/40"
                  >
                    <div className="p-3.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 items-start gap-2.5">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center text-icon">
                            <Receipt size={18} />
                          </div>
                          <div className="min-w-0">
                            <span className="truncate text-[0.9375rem] font-semibold text-text">{customerName(order)}</span>
                            <p className="mt-0.5 font-label text-xs text-text-muted">
                              {order.items.length === 1
                                ? t("sales.mobileSalesOrders.itemsCountOne", { count: order.items.length })
                                : t("sales.mobileSalesOrders.itemsCountOther", { count: order.items.length })}{" "}
                              · {timeAgo(order.createdAt)}
                            </p>
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <span className="block font-headline text-[0.9375rem] font-bold text-text">
                            {formatCurrency(order.totalAmount)}
                          </span>
                          <span className={clsx("mt-1 inline-block rounded-full px-2 py-0.5 font-label text-xs font-bold", status.className)}>
                            {status.label}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <button
            type="button"
            onClick={onNewSale}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 font-headline text-[0.9375rem] font-bold text-on-primary shadow-elevation-1 outline-none transition-all active:scale-[0.98] hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <Receipt size={18} />
            {t("sales.mobileSalesOrders.newSale")}
          </button>
        </>
      )}

      {tab === "invoices" && (
        <>
          <SearchInput
            placeholder={t("sales.mobileSalesOrders.searchByCustomerOrInvoice")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {invoicesQuery.isLoading ? (
            <p className="py-8 text-center text-sm text-text-muted">{t("sales.mobileSalesOrders.loadingInvoices")}</p>
          ) : filteredInvoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-surface py-12 text-center">
              <FileText size={22} className="text-text-muted" strokeWidth={1.5} />
              <p className="mt-2 text-sm font-medium text-text">{t("sales.mobileSalesOrders.noInvoicesFoundTitle")}</p>
              <p className="mt-0.5 text-xs text-text-muted">{t("sales.mobileSalesOrders.noInvoicesFoundDescription")}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredInvoices.map((invoice) => (
                <button
                  key={invoice._id}
                  type="button"
                  onClick={() => setSelectedInvoice(invoice)}
                  className="w-full rounded-xl border border-border bg-surface p-3.5 text-left shadow-elevation-1 outline-none transition-shadow active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="truncate text-[0.9375rem] font-semibold text-text">{invoice.invoiceNumber}</span>
                      <p className="mt-0.5 font-label text-xs text-text-muted">
                        {customerName(invoice)} · {invoice.billType === "gst" ? t("sales.mobileSalesOrders.gst") : t("sales.mobileSalesOrders.record")} · {timeAgo(invoice.createdAt)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="block font-headline text-[0.9375rem] font-bold text-text">
                        {formatCurrency(invoice.totalAmount)}
                      </span>
                      <span className="mt-1 inline-block">
                        {isCancelled(invoice) ? (
                          <Badge tone="neutral">{t("bill.cancelled")}</Badge>
                        ) : (
                          <Badge tone={paymentStatusTone[invoice.paymentStatus]}>{paymentStatusLabel[invoice.paymentStatus]}</Badge>
                        )}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
          {/* Archived bills sit apart; this switches the list between the two. */}
          {invoices.some(isArchived) || showArchived ? (
            <button
              type="button"
              onClick={() => setShowArchived((v) => !v)}
              className="mx-auto mt-3 block rounded-full px-4 py-2 text-sm font-semibold text-primary outline-none hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              {showArchived ? t("bill.backToBills") : t("bill.showArchived", { count: invoices.filter(isArchived).length })}
            </button>
          ) : null}
        </>
      )}

      <OrderDetailModal order={selectedOrder} onClose={() => setSelectedOrder(null)} />
      <InvoiceDetailModal invoice={selectedInvoice} onClose={() => setSelectedInvoice(null)} />
    </div>
  );
}
