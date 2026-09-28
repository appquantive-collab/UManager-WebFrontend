import { useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  Hash,
  Mic,
  Package,
  Receipt,
  ScanLine,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Wallet,
  Warehouse,
} from "lucide-react";
import clsx from "clsx";
import type { AiDashboardLayout } from "../../lib/auth-api";
import type { DashboardSummary } from "../../lib/dashboard-api";
import { useNewOrderModalStore } from "../../lib/new-order-store";
import { useNewSaleModalStore } from "../../lib/new-sale-store";
import { formatCurrency } from "../../lib/format";

const quickActions = [
  { key: "new_order", label: "New Order", icon: Sparkles, className: "bg-primary-container text-primary" },
  { key: "new_sale", label: "New Sale", icon: ShoppingCart, className: "bg-success-container text-success" },
  { key: "voice_order", label: "Voice Order", icon: Mic, className: "bg-info-container text-info" },
  { key: "scan_stock", label: "Scan Stock", icon: ScanLine, className: "bg-surface-muted text-text" },
];

const SECTION_ORDER = ["ai_brief", "quick_actions", "immediate_operations", "ledger_metrics", "order_flow"] as const;
type SectionKey = (typeof SECTION_ORDER)[number];

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

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

const statusLabel: Record<string, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-warning-container text-warning" },
  confirmed: { label: "Confirmed", className: "bg-info-container text-info" },
  delivered: { label: "Billed", className: "bg-success-container text-success" },
  cancelled: { label: "Cancelled", className: "bg-danger-container text-danger" },
};

interface MobileDashboardProps {
  businessName?: string;
  userName?: string;
  aiLayout?: AiDashboardLayout | null;
  summary?: DashboardSummary;
}

export function MobileDashboard({ businessName, userName, aiLayout, summary }: MobileDashboardProps) {
  const [briefOpen, setBriefOpen] = useState(false);
  const openNewOrder = useNewOrderModalStore((state) => state.openModal);
  const openNewSale = useNewSaleModalStore((state) => state.openModal);

  const quickActionHandlers: Record<string, (() => void) | undefined> = {
    new_order: openNewOrder,
    new_sale: openNewSale,
  };

  const orderedSections = useMemo<SectionKey[]>(() => {
    if (!aiLayout) return [...SECTION_ORDER];
    const relevant = aiLayout.sections.filter((s): s is typeof s & { key: SectionKey } =>
      (SECTION_ORDER as readonly string[]).includes(s.key)
    );
    if (relevant.length === 0) return [...SECTION_ORDER];
    const sorted = [...relevant].sort((a, b) => a.priority - b.priority).map((s) => s.key);
    for (const key of SECTION_ORDER) {
      if (!sorted.includes(key)) sorted.push(key);
    }
    return sorted;
  }, [aiLayout]);

  const labelFor = (key: SectionKey, fallback: string) =>
    aiLayout?.sections.find((s) => s.key === key)?.label || fallback;

  const firstName = userName?.trim().split(/\s+/)[0] ?? "";
  const greeting = firstName ? `Good Morning, ${firstName}` : "Good Morning";

  const fallbackBrief = summary
    ? `Today's sales are ${formatCurrency(summary.todaySales)}. ${
        summary.lowStockCount > 0
          ? `${summary.lowStockCount} product${summary.lowStockCount === 1 ? " is" : "s are"} below reorder level.`
          : "No products are below reorder level."
      } ${
        summary.topOverdueCustomerName
          ? `${summary.topOverdueCustomerName} has ${formatCurrency(summary.topOverdueAmount)} overdue.`
          : "No overdue payments."
      }`
    : "Loading your business brief…";

  const sectionRenderers: Record<SectionKey, () => React.ReactNode> = {
    ai_brief: () => (
      <section
        key="ai_brief"
        className="relative overflow-hidden rounded-2xl border border-secondary-container bg-surface shadow-elevation-1"
      >
        <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-secondary-container/60 blur-2xl" />

        <button
          type="button"
          onClick={() => setBriefOpen((open) => !open)}
          aria-expanded={briefOpen}
          className="relative z-10 flex w-full items-start justify-between gap-3 p-4 pb-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-container text-primary">
              <Sparkles size={18} />
            </span>
            <div>
              <span className="block font-label text-[10px] font-bold uppercase tracking-widest text-primary">
                Business Brief
              </span>
              <h3 className="font-headline text-[15px] font-semibold leading-tight text-text">
                {labelFor("ai_brief", "Autonomous Business Brief")}
              </h3>
            </div>
          </div>
          <ChevronDown size={18} className={clsx("shrink-0 text-text-muted transition-transform", briefOpen && "rotate-180")} />
        </button>

        <div
          className={clsx(
            "relative z-10 grid transition-all duration-200 ease-in-out",
            briefOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
          )}
        >
          <div className="overflow-hidden">
            <div className="px-4 pb-4">
              <p className="text-[13px] leading-relaxed text-text-muted">{aiLayout?.welcomeMessage ?? fallbackBrief}</p>
            </div>
          </div>
        </div>
      </section>
    ),

    quick_actions: () => (
      <section key="quick_actions" className="grid grid-cols-4 gap-2">
        {quickActions.map((action) => (
          <button
            key={action.key}
            type="button"
            onClick={quickActionHandlers[action.key]}
            className="group flex flex-col items-center justify-center rounded-xl border border-border bg-surface p-3 outline-none transition-all hover:border-primary/30 active:scale-95 focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <span
              className={`flex h-10 w-10 items-center justify-center rounded-xl transition-transform group-hover:scale-110 ${action.className}`}
            >
              <action.icon size={22} />
            </span>
            <span className="mt-2 text-center font-label text-[11px] font-semibold text-text">
              {aiLayout?.quickActionLabels[action.key] || action.label}
            </span>
          </button>
        ))}
      </section>
    ),

    immediate_operations: () => {
      const hasLowStock = (summary?.lowStockCount ?? 0) > 0;
      const hasOverdue = (summary?.overdueCustomerCount ?? 0) > 0;
      const cards = [
        hasLowStock
          ? {
              icon: Package,
              iconClass: "bg-danger-container text-danger",
              badge: `${summary!.lowStockCount} Low Stock`,
              badgeClass: "bg-danger-container text-danger",
              title: summary!.lowStockItems.slice(0, 2).join(" • ") || "Low stock items",
              detail: "Below reorder level",
            }
          : null,
        hasOverdue
          ? {
              icon: Wallet,
              iconClass: "bg-primary-container text-primary",
              badge: `${formatCurrency(summary!.receivables)} Overdue`,
              badgeClass: "bg-primary-container text-primary",
              title: `${summary!.overdueCustomerCount} ${summary!.overdueCustomerCount === 1 ? "Party" : "Parties"} Pending`,
              detail: summary!.topOverdueCustomerName
                ? `Top: ${summary!.topOverdueCustomerName} (${formatCurrency(summary!.topOverdueAmount)})`
                : "",
            }
          : null,
      ].filter((c): c is NonNullable<typeof c> => c !== null);

      return (
        <section key="immediate_operations" className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className={clsx("h-2 w-2 rounded-full", cards.length > 0 ? "bg-danger" : "bg-success")} />
              <h3 className="font-headline text-[14px] font-bold uppercase tracking-wide text-text">
                {labelFor("immediate_operations", "Immediate Operations")}
              </h3>
            </div>
            {cards.length > 0 && (
              <span className="rounded-full bg-danger-container px-2 py-0.5 font-label text-[11px] font-bold text-danger">
                {cards.length} Pending
              </span>
            )}
          </div>

          {cards.length === 0 ? (
            <div className="rounded-xl border border-border bg-surface p-4 text-center text-sm text-text-muted">
              All clear — no low stock or overdue payments.
            </div>
          ) : (
            <div className="scrollbar-hide flex gap-2.5 overflow-x-auto pb-1">
              {cards.map((item) => (
                <div
                  key={item.title}
                  className="flex min-w-55 shrink-0 flex-col justify-between rounded-xl border border-border bg-surface p-3.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${item.iconClass}`}>
                      <item.icon size={18} />
                    </span>
                    <span className={`rounded-full px-2 py-0.5 font-label text-[10px] font-bold ${item.badgeClass}`}>
                      {item.badge}
                    </span>
                  </div>
                  <div className="mt-2.5">
                    <p className="truncate text-[13px] font-semibold text-text">{item.title}</p>
                    {item.detail ? <p className="mt-0.5 font-label text-[11px] text-text-muted">{item.detail}</p> : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      );
    },

    ledger_metrics: () => {
      const changePercent = summary?.salesChangePercent ?? null;
      return (
        <section key="ledger_metrics" className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="font-headline text-[14px] font-bold uppercase tracking-wide text-text">
              {labelFor("ledger_metrics", "Ledger & Logistics Metrics")}
            </h3>
            <span className="font-label text-[10px] font-medium text-text-muted">Updated real-time</span>
          </div>

          <div className="rounded-2xl border border-border bg-surface p-4 shadow-elevation-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="block font-label text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                  Today&apos;s Total Billing
                </span>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="font-headline text-3xl font-bold tracking-tight text-text">
                    {formatCurrency(summary?.todaySales ?? 0)}
                  </span>
                  {changePercent != null && (
                    <span
                      className={clsx(
                        "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-label text-[11px] font-bold",
                        changePercent >= 0 ? "bg-success-container text-success" : "bg-danger-container text-danger"
                      )}
                    >
                      {changePercent >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                      {changePercent >= 0 ? "+" : ""}
                      {changePercent.toFixed(1)}%
                    </span>
                  )}
                </div>
                <span className="mt-1 block font-label text-[11px] text-text-muted">
                  vs {formatCurrency(summary?.yesterdaySales ?? 0)} yesterday
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="flex flex-col justify-between rounded-xl border border-border bg-surface p-3.5">
              <div className="flex items-center justify-between">
                <span className="font-label text-[10px] font-bold uppercase tracking-wider text-text-muted">Month Sales</span>
                <CalendarDays size={17} className="text-primary" />
              </div>
              <div className="mt-2.5">
                <span className="block font-headline text-lg font-bold text-text">
                  {formatCurrency(summary?.monthSales ?? 0)}
                </span>
              </div>
            </div>

            <div className="flex flex-col justify-between rounded-xl border border-border bg-surface p-3.5">
              <div className="flex items-center justify-between">
                <span className="font-label text-[10px] font-bold uppercase tracking-wider text-text-muted">Inventory Val.</span>
                <Warehouse size={17} className="text-success" />
              </div>
              <div className="mt-2.5">
                <span className="block font-headline text-lg font-bold text-text">
                  {formatCurrency(summary?.inventoryValue ?? 0)}
                </span>
                <div className="mt-1.5 flex items-center gap-1 font-label text-[11px] text-text-muted">
                  <Hash size={13} />
                  <span>{summary?.totalSkus ?? 0} Total SKUs</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col justify-between rounded-xl border border-border bg-surface p-3.5">
              <div className="flex items-center justify-between">
                <span className="font-label text-[10px] font-bold uppercase tracking-wider text-text-muted">Receivables</span>
                <Wallet size={17} className="text-info" />
              </div>
              <div className="mt-2.5">
                <span className="block font-headline text-lg font-bold text-text">
                  {formatCurrency(summary?.receivables ?? 0)}
                </span>
                {summary && summary.overdueCustomerCount > 0 ? (
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-danger" />
                    <span className="font-label text-[10px] font-bold text-danger">
                      {summary.overdueCustomerCount} overdue
                    </span>
                  </div>
                ) : (
                  <span className="mt-1.5 block font-label text-[10px] text-text-muted">All clear</span>
                )}
              </div>
            </div>

            <div className="flex flex-col justify-between rounded-xl border border-border bg-surface p-3.5">
              <div className="flex items-center justify-between">
                <span className="font-label text-[10px] font-bold uppercase tracking-wider text-text-muted">Payables</span>
                <span className="text-[10px] text-text-muted">—</span>
              </div>
              <div className="mt-2.5">
                <span className="block font-headline text-lg font-bold text-text-muted">Not tracked</span>
                <span className="mt-0.5 block font-label text-[10px] text-text-muted">No purchases module yet</span>
              </div>
            </div>
          </div>
        </section>
      );
    },

    order_flow: () => (
      <section key="order_flow" className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Receipt size={18} className="text-primary" />
            <h3 className="font-headline text-[14px] font-bold uppercase tracking-wide text-text">
              {labelFor("order_flow", "Live Order Flow")}
            </h3>
          </div>
        </div>

        {!summary || summary.recentOrders.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface p-4 text-center text-sm text-text-muted">
            No orders yet.
          </div>
        ) : (
          <div className="space-y-2">
            {summary.recentOrders.map((order) => {
              const status = statusLabel[order.status] ?? statusLabel.pending;
              return (
                <div
                  key={order.id}
                  className="flex items-center justify-between rounded-xl border border-border bg-surface p-3 transition-colors hover:bg-surface-muted"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-container font-headline text-xs font-bold text-primary">
                      {initialsFor(order.customerName)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-[13px] font-semibold text-text">{order.customerName}</span>
                      </div>
                      <p className="truncate font-label text-[11px] text-text-muted">
                        {order.itemCount} item{order.itemCount === 1 ? "" : "s"} · {timeAgo(order.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end pl-2">
                    <span className="font-label text-xs font-bold text-text">{formatCurrency(order.amount)}</span>
                    <span className={`mt-1 rounded-full px-2 py-0.5 font-label text-[10px] font-bold ${status.className}`}>
                      {status.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    ),
  };

  return (
    <div className="space-y-4">
      <section className="flex items-center justify-between gap-3 pt-1">
        <div className="min-w-0">
          <h2 className="truncate font-headline text-lg font-bold tracking-tight text-text">{greeting}</h2>
          {businessName ? <p className="truncate text-xs text-text-muted">{businessName}</p> : null}
        </div>
      </section>

      {orderedSections.map((key) => sectionRenderers[key]())}

      <footer className="flex items-center justify-between rounded-xl border border-border bg-surface p-3">
        <div className="flex items-center gap-2">
          <ShieldCheck size={18} className="text-success" />
          <div className="flex flex-col">
            <span className="font-label text-[11px] font-bold text-text">All data synced</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
