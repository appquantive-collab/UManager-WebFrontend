import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { FileText, Receipt, Sparkles, Undo2 } from "lucide-react";
import { SearchInput } from "../../components/ui/SearchInput";
import { formatCurrency } from "../../lib/format";
import { listOrders, type Order } from "../../lib/orders-api";

const salesTabs = [
  { key: "orders", label: "Orders", icon: Receipt },
  { key: "invoices", label: "Invoices", icon: FileText },
  { key: "quotes", label: "Quotes", icon: FileText },
  { key: "returns", label: "Returns", icon: Undo2 },
];

type FilterKey = "all" | "pending" | "delivered" | "cancelled";

function customerName(order: Order): string {
  return typeof order.customerId === "string" ? "Unknown customer" : order.customerId.name;
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const statusBadge: Record<Order["status"], { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-warning-container text-warning" },
  confirmed: { label: "Confirmed", className: "bg-info-container text-info" },
  delivered: { label: "Billed", className: "bg-success-container text-success" },
  cancelled: { label: "Cancelled", className: "bg-danger-container text-danger" },
};

export function MobileSalesOrders({
  onNewOrder,
  onNewSale,
}: {
  onNewOrder?: () => void;
  onNewSale?: () => void;
}) {
  const [tab, setTab] = useState("orders");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");

  const ordersQuery = useQuery({ queryKey: ["orders"], queryFn: () => listOrders() });
  const orders = ordersQuery.data ?? [];

  const filters = useMemo(() => {
    const pending = orders.filter((o) => o.status === "pending" || o.status === "confirmed").length;
    const delivered = orders.filter((o) => o.status === "delivered").length;
    const cancelled = orders.filter((o) => o.status === "cancelled").length;
    return [
      { key: "all" as const, label: "All Orders", count: orders.length },
      { key: "pending" as const, label: "Pending", count: pending },
      { key: "delivered" as const, label: "Billed", count: delivered },
      { key: "cancelled" as const, label: "Cancelled", count: cancelled },
    ];
  }, [orders]);

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

  const grossValue = orders.reduce((sum, o) => sum + o.totalAmount, 0);
  const avgTicket = orders.length > 0 ? grossValue / orders.length : 0;

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-surface-muted p-1">
        <div className="grid grid-cols-4 gap-1">
          {salesTabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={clsx(
                "flex items-center justify-center gap-1 rounded-lg py-2 font-label text-[11px] font-semibold tracking-wide outline-none transition-all focus-visible:ring-2 focus-visible:ring-primary/40",
                tab === t.key ? "bg-primary text-on-primary shadow-elevation-1" : "text-text-muted hover:text-text"
              )}
            >
              <t.icon size={14} />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab !== "orders" ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-surface py-16 text-center">
          <FileText size={24} className="text-text-muted" strokeWidth={1.5} />
          <h3 className="mt-3 text-sm font-semibold text-text">
            {salesTabs.find((t) => t.key === tab)?.label} coming soon
          </h3>
          <p className="mt-1 text-sm text-text-muted">This section is being designed.</p>
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-border bg-surface p-3 shadow-elevation-1">
            <div className="mb-2 flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-primary" />
              <span className="font-label text-[10px] font-semibold uppercase tracking-wider text-primary">
                Order Summary
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1.5 text-center">
              <div className="rounded-lg border border-border bg-surface-muted p-2">
                <span className="block font-label text-[10px] text-text-muted">Gross Value</span>
                <span className="mt-0.5 block font-label text-[11px] font-bold text-primary">
                  {formatCurrency(grossValue)}
                </span>
              </div>
              <div className="rounded-lg border border-border bg-surface-muted p-2">
                <span className="block font-label text-[10px] text-text-muted">Orders</span>
                <span className="mt-0.5 block font-label text-[13px] font-bold text-text">{orders.length}</span>
              </div>
              <div className="rounded-lg border border-border bg-surface-muted p-2">
                <span className="block font-label text-[10px] text-text-muted">Avg Ticket</span>
                <span className="mt-0.5 block truncate font-label text-[13px] font-bold text-text">
                  {formatCurrency(avgTicket)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <SearchInput
              placeholder="Search by customer…"
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
            <span className="font-label text-[12px] font-bold uppercase tracking-wide">New Order (Type or Paste)</span>
          </button>

          <div className="scrollbar-hide flex items-center gap-2 overflow-x-auto pb-1">
            {filters.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={clsx(
                  "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 font-label text-[11px] font-semibold outline-none transition-all focus-visible:ring-2 focus-visible:ring-primary/40",
                  filter === f.key
                    ? "bg-primary text-on-primary shadow-elevation-1"
                    : "border border-border bg-surface text-text-muted hover:text-text"
                )}
              >
                <span>{f.label}</span>
                <span
                  className={clsx(
                    "rounded-full px-1.5 py-px text-[10px]",
                    filter === f.key ? "bg-on-primary/20" : "text-text-muted"
                  )}
                >
                  {f.count}
                </span>
              </button>
            ))}
          </div>

          {ordersQuery.isLoading ? (
            <p className="py-8 text-center text-sm text-text-muted">Loading orders…</p>
          ) : filteredOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-surface py-12 text-center">
              <Receipt size={22} className="text-text-muted" strokeWidth={1.5} />
              <p className="mt-2 text-sm font-medium text-text">No orders found</p>
              <p className="mt-0.5 text-xs text-text-muted">Try a different filter or create a new order.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredOrders.map((order) => {
                const status = statusBadge[order.status];
                return (
                  <div
                    key={order._id}
                    className="relative overflow-hidden rounded-xl border border-border bg-surface shadow-elevation-1"
                  >
                    <div className="p-3.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 items-start gap-2.5">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-muted text-text-muted">
                            <Receipt size={18} />
                          </div>
                          <div className="min-w-0">
                            <span className="truncate text-[15px] font-semibold text-text">{customerName(order)}</span>
                            <p className="mt-0.5 font-label text-[11px] text-text-muted">
                              {order.items.length} item{order.items.length === 1 ? "" : "s"} · {timeAgo(order.createdAt)}
                            </p>
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <span className="block font-headline text-[15px] font-bold text-text">
                            {formatCurrency(order.totalAmount)}
                          </span>
                          <span className={clsx("mt-1 inline-block rounded-full px-2 py-0.5 font-label text-[10px] font-bold", status.className)}>
                            {status.label}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <button
            type="button"
            onClick={onNewSale}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 font-headline text-[15px] font-bold text-on-primary shadow-elevation-1 outline-none transition-all active:scale-[0.98] hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <Receipt size={18} />
            New Sale
          </button>
        </>
      )}
    </div>
  );
}
