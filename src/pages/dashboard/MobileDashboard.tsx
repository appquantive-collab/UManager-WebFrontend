import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowDown,
  ArrowUp,
  AudioLines,
  Box,
  Boxes,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  IndianRupee,
  MessageCircle,
  Mic,
  Phone,
  ReceiptText,
  ShoppingCart,
  TrendingUp,
  UserRound,
  Wallet,
} from "lucide-react";
import clsx from "clsx";
import type { AiDashboardLayout } from "../../lib/auth-api";
import type { DashboardSummary } from "../../lib/dashboard-api";
import { useAuthStore } from "../../lib/auth-store";
import { useNewOrderModalStore } from "../../lib/new-order-store";
import { useNewSaleModalStore } from "../../lib/new-sale-store";
import { formatCurrency } from "../../lib/format";
import { indianMobile, whatsappLink } from "../../lib/phone";
import { IconTile, type TileTone } from "../../components/ui/IconTile";

interface MobileDashboardProps {
  aiLayout?: AiDashboardLayout | null;
  summary?: DashboardSummary;
  businessName?: string;
}

const statusClassName: Record<string, string> = {
  pending: "bg-warning-container text-warning",
  confirmed: "bg-info-container text-info",
  delivered: "bg-success-container text-success",
  cancelled: "bg-danger text-white",
};

/** The phone home screen: greeting + Munshi, quick actions, today's numbers, today's to-dos. */
export function MobileDashboard({ summary, businessName }: MobileDashboardProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const ownerName = useAuthStore((state) => state.user?.name) ?? "";
  const firstName = ownerName.trim().split(/\s+/)[0] ?? "";
  const openNewOrder = useNewOrderModalStore((state) => state.openModal);
  const openNewSale = useNewSaleModalStore((state) => state.openModal);
  const lang = i18n.resolvedLanguage ?? "en";
  const today = new Date().toLocaleDateString(lang === "hi" ? "hi-IN" : "en-IN", { day: "numeric", month: "short", year: "numeric" });

  const quickActions: { key: string; tone: TileTone; icon: typeof ReceiptText; onClick: () => void; badge?: boolean }[] = [
    { key: "sale", tone: "sale", icon: ReceiptText, onClick: openNewSale },
    { key: "order", tone: "order", icon: ShoppingCart, onClick: openNewOrder },
    { key: "stock", tone: "stock", icon: Boxes, onClick: () => navigate("/app/inventory") },
    { key: "pay", tone: "pay", icon: UserRound, onClick: () => navigate("/app/customers"), badge: true },
  ];

  const change = summary?.salesChangePercent ?? null;
  const lowStockCount = summary?.lowStockCount ?? 0;

  return (
    <div className="space-y-6 pb-2">
      {/* ---------- Hero: greeting + talk to Munshi ---------- */}
      <section className="relative flex min-h-[13.5rem] items-center overflow-hidden rounded-3xl border border-primary/10 bg-[linear-gradient(120deg,#fff7f1_0%,#ffeadb_100%)]">
        <span aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-white/60 blur-2xl" />
        <MunshiAvatar />
        {/* Soft voice bars beside Munshi. */}
        <AudioLines size={30} strokeWidth={2.2} aria-hidden="true" className="pointer-events-none absolute right-[40%] top-[34%] hidden text-primary/45 min-[480px]:block" />

        <div className="relative w-[70%] py-6 pl-5 min-[480px]:w-[62%]">
          <h1 className="text-[1.375rem] font-bold leading-tight tracking-tight text-text min-[400px]:text-2xl">
            {firstName ? t("dashboard.home.greeting", { name: firstName }) : t("dashboard.home.greetingNoName")}
          </h1>
          <p className="mt-1 text-sm leading-snug text-text-subtle">{t("dashboard.home.subtitle")}</p>
          <Link
            to="/app/ai"
            className="mt-5 inline-flex h-12 w-fit max-w-full items-center justify-start gap-2.5 rounded-full bg-brand-gradient pl-4 pr-4 text-[0.9375rem] font-semibold text-white shadow-brand outline-none transition-transform active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
          >
            <Mic size={21} strokeWidth={2.2} className="shrink-0" aria-hidden="true" />
            <span className="whitespace-nowrap">{t("dashboard.home.talk")}</span>
          </Link>
          <p className="mt-3 text-xs leading-relaxed text-text-subtle">
            {[t("dashboard.home.hint1"), t("dashboard.home.hint2"), t("dashboard.home.hint3")].join("  •  ")}
          </p>
        </div>
      </section>

      {/* ---------- Quick actions ---------- */}
      <section className="grid grid-cols-4 gap-2.5" aria-label={t("dashboard.home.quickActions")}>
        {quickActions.map((action) => (
          <button
            key={action.key}
            type="button"
            onClick={action.onClick}
            className="flex min-w-0 flex-col items-center gap-2 rounded-2xl border border-border bg-surface px-1 py-3 shadow-card text-center outline-none transition-[transform,background-color] active:scale-[0.97] active:bg-surface-muted focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <IconTile
              icon={action.icon}
              tone={action.tone}
              round
              badge={
                action.badge ? (
                  <span className="absolute -bottom-0.5 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-surface text-tile-pay">
                    <IndianRupee size={12} strokeWidth={2.6} />
                  </span>
                ) : null
              }
            />
            <span className="w-full min-w-0">
              <span className="block truncate text-[0.8125rem] font-semibold leading-tight text-text">{t(`dashboard.home.qa.${action.key}.title`)}</span>
              <span className="mt-0.5 block truncate text-[0.6875rem] leading-tight text-text-muted">{t(`dashboard.home.qa.${action.key}.sub`)}</span>
            </span>
          </button>
        ))}
      </section>

      {/* ---------- Today's numbers ---------- */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-bold tracking-tight text-text">{t("dashboard.home.todayTitle")}</h2>
          <span className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text shadow-card">
            <CalendarDays size={14} className="text-icon" aria-hidden="true" />
            {today}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          <StatCard
            icon={TrendingUp}
            iconClass="text-success"
            className="bg-[linear-gradient(160deg,#f3fcf6_0%,#ffffff_70%)]"
            label={t("dashboard.home.todaySales")}
            value={formatCurrency(summary?.todaySales ?? 0)}
            extra={
              change != null ? (
                <span className={clsx("inline-flex items-center gap-0.5 text-xs font-semibold", change >= 0 ? "text-success" : "text-danger")}>
                  {change >= 0 ? <ArrowUp size={12} strokeWidth={2.6} /> : <ArrowDown size={12} strokeWidth={2.6} />}
                  {change >= 0 ? "+" : ""}
                  {Math.round(change)}%
                </span>
              ) : null
            }
            loading={!summary}
          />
          <StatCard
            icon={Wallet}
            iconClass="text-primary"
            className="bg-[linear-gradient(160deg,#fff6ef_0%,#ffffff_70%)]"
            label={t("dashboard.home.toCollect")}
            value={formatCurrency(summary?.receivables ?? 0)}
            onClick={() => navigate("/app/customers")}
            loading={!summary}
          />
          <StatCard
            icon={Box}
            iconClass="text-danger"
            className={lowStockCount > 0 ? "border-danger/15 bg-[linear-gradient(160deg,#fff1f1_0%,#fff8f8_70%)]" : undefined}
            label={t("dashboard.home.lowStock")}
            value={t("dashboard.home.itemsCount", { count: lowStockCount })}
            valueClass={lowStockCount > 0 ? "text-danger" : undefined}
            onClick={() => navigate("/app/inventory")}
            loading={!summary}
          />
        </div>
      </section>

      {/* ---------- Today's to-dos ---------- */}
      <AttentionCard summary={summary} businessName={businessName} />

      {/* ---------- Latest orders ---------- */}
      {summary && summary.recentOrders.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-lg font-bold tracking-tight text-text">{t("dashboard.home.recentOrders")}</h2>
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface shadow-card">
            {summary.recentOrders.map((order) => (
              <li key={order.id} className="flex items-center gap-3 px-4 py-3">
                <IconTile icon={ClipboardList} tone="neutral" size="sm" round />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-text">{order.customerName}</p>
                  <p className="truncate text-xs text-text-muted">
                    {t(order.itemCount === 1 ? "dashboard.mobileDashboard.itemsCountOne" : "dashboard.mobileDashboard.itemsCountOther", { count: order.itemCount })}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-sm font-bold tabular-nums text-text">{formatCurrency(order.amount)}</span>
                  <span className={clsx("rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold", statusClassName[order.status] ?? statusClassName.pending)}>
                    {t(`dashboard.mobileDashboard.statusLabel.${order.status}`)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

/**
 * Munshi standing at the right of the greeting. Uses the cut-out picture
 * /munshi-hero.png (transparent background) when it's in web/public; until
 * then the Munshi photo, its edges faded into the card.
 */
function MunshiAvatar() {
  const [cutout, setCutout] = useState(true);
  return cutout ? (
    <img
      src="/munshi-hero.png"
      alt=""
      onError={() => setCutout(false)}
      className="pointer-events-none absolute bottom-0 right-0 h-[96%] w-auto max-w-[44%] object-contain object-bottom"
    />
  ) : (
    <img
      src="/splash-munshi.webp"
      alt=""
      // One soft fade from the left only (two combined masks left a hard edge in some browsers).
      className="pointer-events-none absolute inset-y-0 right-0 h-full w-[46%] object-cover object-[50%_18%] [mask-image:linear-gradient(to_right,transparent_0%,rgba(0,0,0,0.55)_28%,black_58%)] [-webkit-mask-image:linear-gradient(to_right,transparent_0%,rgba(0,0,0,0.55)_28%,black_58%)]"
    />
  );
}

function StatCard({
  icon: Icon,
  iconClass,
  label,
  value,
  valueClass,
  extra,
  className,
  onClick,
  loading,
}: {
  icon: typeof Wallet;
  iconClass: string;
  label: string;
  value: string;
  valueClass?: string;
  extra?: React.ReactNode;
  className?: string;
  onClick?: () => void;
  loading?: boolean;
}) {
  const body = (
    <>
      <Icon size={22} strokeWidth={2} className={iconClass} aria-hidden="true" />
      <span className="mt-2.5 block truncate text-xs text-text-subtle">{label}</span>
      {loading ? (
        <span className="mt-1.5 block h-6 w-16 animate-pulse rounded-md bg-surface-variant" />
      ) : (
        <span className={clsx("mt-0.5 block truncate text-lg font-bold tabular-nums tracking-tight text-text min-[400px]:text-xl", valueClass)} title={value}>
          {value}
        </span>
      )}
      {extra ? <span className="mt-0.5 block">{extra}</span> : null}
    </>
  );
  const shell = clsx("min-w-0 rounded-2xl border border-border bg-surface p-3 text-left shadow-card", className);
  return onClick ? (
    <button type="button" onClick={onClick} className={clsx(shell, "outline-none transition-transform active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-primary/40")}>
      {body}
    </button>
  ) : (
    <div className={shell}>{body}</div>
  );
}

/** "Aaj dhyan dene wale kaam": dues, low stock and orders waiting; each row opens its details. */
function AttentionCard({ summary, businessName }: { summary?: DashboardSummary; businessName?: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState<string | null>(null);
  const dues = summary?.topDues ?? [];
  const lowStock = summary?.lowStockDetails ?? [];
  const pendingOrders = summary?.pendingOrderCount ?? 0;
  const total = dues.length + lowStock.length + pendingOrders;
  const names = (list: string[]) => (list.length > 3 ? `${list.slice(0, 3).join(", ")}, ${t("dashboard.home.etc")}` : list.join(", "));

  const rows = [
    dues.length > 0 && {
      key: "dues",
      tone: "sale" as TileTone,
      icon: UserRound,
      title: t("dashboard.home.duesRow", { count: dues.length }),
      sub: names(dues.map((d) => d.name)),
    },
    lowStock.length > 0 && {
      key: "stock",
      tone: "sale" as TileTone,
      icon: Box,
      title: t("dashboard.home.stockRow", { count: lowStock.length }),
      sub: names(lowStock.map((s) => s.name)),
    },
    pendingOrders > 0 && {
      key: "orders",
      tone: "order" as TileTone,
      icon: ClipboardList,
      title: t("dashboard.home.ordersRow", { count: pendingOrders }),
      sub: "",
    },
  ].filter(Boolean) as { key: string; tone: TileTone; icon: typeof Box; title: string; sub: string }[];

  return (
    <section className="rounded-2xl border border-border bg-surface shadow-card" aria-labelledby="home-attention">
      <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-4">
        <h2 id="home-attention" className="text-lg font-bold tracking-tight text-text">
          {t("dashboard.home.attentionTitle")}
        </h2>
        {total > 0 ? (
          <span className="shrink-0 rounded-full bg-primary px-2.5 py-1 text-xs font-bold text-white">{t("dashboard.home.total", { count: total })}</span>
        ) : null}
      </div>

      {!summary ? (
        <div className="space-y-2 px-4 pb-4" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl bg-surface-variant" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="px-4 pb-5 pt-1 text-sm text-text-muted">{t("dashboard.attention.allClear")}</p>
      ) : (
        <ul className="divide-y divide-border px-2 pb-2">
          {rows.map((row) => {
            const expanded = open === row.key;
            return (
              <li key={row.key}>
                {row.key === "orders" ? (
                  <Link to="/app/sales" className="flex items-center gap-3 rounded-xl px-2 py-3 outline-none active:bg-surface-muted focus-visible:ring-2 focus-visible:ring-primary/40">
                    <IconTile icon={row.icon} tone={row.tone} round />
                    <span className="min-w-0 flex-1 text-[0.9375rem] font-semibold text-text">{row.title}</span>
                    <ChevronRight size={20} className="shrink-0 text-icon" aria-hidden="true" />
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => setOpen(expanded ? null : row.key)}
                    aria-expanded={expanded}
                    className="flex w-full items-center gap-3 rounded-xl px-2 py-3 text-left outline-none active:bg-surface-muted focus-visible:ring-2 focus-visible:ring-primary/40"
                  >
                    <IconTile icon={row.icon} tone={row.tone} round />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[0.9375rem] font-semibold leading-snug text-text">{row.title}</span>
                      {row.sub ? <span className="mt-0.5 block truncate text-[0.8125rem] text-text-muted">{row.sub}</span> : null}
                    </span>
                    <ChevronRight size={20} className={clsx("shrink-0 text-icon transition-transform", expanded && "rotate-90")} aria-hidden="true" />
                  </button>
                )}

                {expanded && row.key === "dues" ? (
                  <ul className="space-y-2 px-2 pb-3">
                    {dues.map((due) => {
                      const mobile = indianMobile(due.phone);
                      const reminder = t("dashboard.attention.reminderMessage", { name: due.name, amount: formatCurrency(due.due), business: businessName ?? "VoiceMunshi" });
                      return (
                        <li key={due.customerId} className="flex items-center gap-2 rounded-xl bg-surface-muted px-3 py-2">
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-text">{due.name}</span>
                            <span className="block text-xs text-text-muted">{t("dashboard.attention.bills", { count: due.invoiceCount })}</span>
                          </span>
                          <span className="shrink-0 text-sm font-bold tabular-nums text-danger">{formatCurrency(due.due)}</span>
                          {mobile ? (
                            <>
                              <a
                                href={`tel:+${mobile}`}
                                aria-label={t("dashboard.attention.call", { name: due.name })}
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-text outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                              >
                                <Phone size={16} aria-hidden="true" />
                              </a>
                              <a
                                href={whatsappLink(mobile, reminder)}
                                target="_blank"
                                rel="noreferrer"
                                aria-label={t("dashboard.attention.whatsapp", { name: due.name })}
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-success text-white outline-none focus-visible:ring-2 focus-visible:ring-success/40"
                              >
                                <MessageCircle size={16} aria-hidden="true" />
                              </a>
                            </>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                ) : null}

                {expanded && row.key === "stock" ? (
                  <div className="px-2 pb-3">
                    <ul className="space-y-1.5">
                      {lowStock.map((item) => (
                        <li key={item.productId} className="flex items-center justify-between gap-3 rounded-xl bg-surface-muted px-3 py-2">
                          <span className="min-w-0 truncate text-sm font-semibold text-text">{item.name}</span>
                          <span
                            className={clsx(
                              "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold",
                              item.quantity <= 0 ? "bg-danger text-white" : "bg-warning-container text-warning"
                            )}
                          >
                            {item.quantity <= 0 ? t("dashboard.attention.outOfStock") : t("dashboard.attention.leftOf", { quantity: item.quantity, reorder: item.reorderLevel })}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <Link to="/app/inventory" className="mt-2 inline-block px-1 text-sm font-semibold text-primary">
                      {t("dashboard.attention.openInventory")}
                    </Link>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
