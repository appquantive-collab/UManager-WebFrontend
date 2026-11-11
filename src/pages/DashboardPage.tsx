import { useEffect, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  IndianRupee,
  PackagePlus,
  ReceiptText,
  ShoppingCart,
  Sparkles,
  UserPlus,
  Wallet,
} from "lucide-react";
import clsx from "clsx";
import { formatCurrency } from "../lib/format";
import { MobileDashboard } from "./dashboard/MobileDashboard";
import { NeedsAttention } from "../components/dashboard/NeedsAttention";
import { getProfile, type AiDashboardLayout } from "../lib/auth-api";
import { getDashboardSummary, type DashboardSummary } from "../lib/dashboard-api";
import { useAuthStore } from "../lib/auth-store";
import { useNewOrderModalStore } from "../lib/new-order-store";
import { useNewSaleModalStore } from "../lib/new-sale-store";

/** en-IN for English and Hinglish, hi-IN for Hindi: Indian digit grouping and day names. */
function dateLocale(language: string): string {
  return language === "hi" ? "hi-IN" : "en-IN";
}

const compactRupees = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  notation: "compact",
  maximumFractionDigits: 1,
});

// ---------- Headline numbers ----------

type Tone = "primary" | "success" | "danger" | "warning";

function KpiCard({
  label,
  value,
  detail,
  icon,
  to,
}: {
  label: string;
  value: string;
  detail?: ReactNode;
  icon: ReactNode;
  /** Kept for callers; icons are always plain grey now. */
  tone?: Tone;
  to?: string;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-text-muted">{label}</p>
        <span className="shrink-0 text-icon" aria-hidden="true">
          {icon}
        </span>
      </div>
      <p className="mt-2 text-[1.75rem] font-extrabold leading-tight tracking-tight tabular-nums text-text">{value}</p>
      {detail ? <div className="mt-1.5 text-sm text-text-muted">{detail}</div> : null}
    </>
  );
  const className =
    "block rounded-2xl border border-border bg-surface p-5 shadow-elevation-1 outline-none transition-[border-color,box-shadow]";
  return to ? (
    <Link to={to} className={clsx(className, "hover:border-primary/50 hover:shadow-elevation-2 focus-visible:ring-2 focus-visible:ring-primary/40")}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

function SalesChange({ percent }: { percent: number | null | undefined }) {
  const { t } = useTranslation();
  if (percent == null) return <span>{t("dashboard.desk.noComparison")}</span>;
  const up = percent >= 0;
  return (
    <span className={clsx("inline-flex items-center gap-1 font-semibold", up ? "text-success" : "text-danger")}>
      {up ? <ArrowUpRight size={15} aria-hidden="true" /> : <ArrowDownRight size={15} aria-hidden="true" />}
      {t("dashboard.desk.vsYesterday", { sign: up ? "+" : "", percent: Math.abs(percent).toFixed(1) })}
    </span>
  );
}

// ---------- Sales chart ----------

function SalesTrendChart({ data, weekSales, language }: { data: DashboardSummary["salesTrend"]; weekSales: number; language: string }) {
  const { t } = useTranslation();
  const locale = dateLocale(language);
  const points = data.map((d) => ({
    ...d,
    label: d.date ? new Date(`${d.date}T00:00:00`).toLocaleDateString(locale, { weekday: "short" }) : d.day,
  }));
  const hasSales = points.some((p) => p.sales > 0);

  return (
    <section className="rounded-2xl border border-border bg-surface p-5 shadow-elevation-1" aria-labelledby="sales-trend">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="sales-trend" className="text-base font-bold text-text">
            {t("dashboard.desk.salesTrend")}
          </h2>
          <p className="mt-0.5 text-sm text-text-muted">{t("dashboard.desk.last7Days")}</p>
        </div>
        <p className="text-right">
          <span className="block text-xs font-semibold uppercase tracking-wide text-text-muted">{t("dashboard.desk.weekTotal")}</span>
          <span className="text-xl font-extrabold tabular-nums text-text">{formatCurrency(weekSales)}</span>
        </p>
      </div>

      <div className="relative mt-4 h-60">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.22} />
                <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="4 4" />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "var(--color-text-muted)", fontSize: 13, fontWeight: 600 }}
            />
            <YAxis
              width={56}
              axisLine={false}
              tickLine={false}
              tickFormatter={(value: number) => compactRupees.format(value)}
              tick={{ fill: "var(--color-text-muted)", fontSize: 12 }}
            />
            <Tooltip
              cursor={{ stroke: "var(--color-primary)", strokeDasharray: "4 4" }}
              contentStyle={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: 12,
                fontSize: 13,
                color: "var(--color-text)",
                boxShadow: "0 12px 32px 0 rgba(59, 31, 18, 0.16)",
              }}
              formatter={(value) => [formatCurrency(Number(value)), t("dashboard.desk.sales")]}
              labelStyle={{ color: "var(--color-text-muted)", fontWeight: 600 }}
            />
            <Area
              type="monotone"
              dataKey="sales"
              stroke="var(--color-primary)"
              strokeWidth={2.5}
              fill="url(#salesFill)"
              dot={{ r: 3, fill: "var(--color-primary)" }}
              activeDot={{ r: 5 }}
            />
          </AreaChart>
        </ResponsiveContainer>
        {!hasSales ? (
          <p className="absolute inset-0 flex items-center justify-center text-sm font-medium text-text-muted">
            {t("dashboard.desk.noSalesThisWeek")}
          </p>
        ) : null}
      </div>
    </section>
  );
}

// ---------- Recent orders ----------

const statusTone: Record<string, string> = {
  pending: "bg-warning-container text-warning",
  confirmed: "bg-info-container text-info",
  delivered: "bg-success-container text-success",
  cancelled: "bg-surface-variant text-text-muted",
};

function RecentOrders({ orders, language }: { orders: DashboardSummary["recentOrders"]; language: string }) {
  const { t } = useTranslation();
  const locale = dateLocale(language);
  return (
    <section className="rounded-2xl border border-border bg-surface shadow-elevation-1" aria-labelledby="recent-orders">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <h2 id="recent-orders" className="text-base font-bold text-text">
          {t("dashboard.desk.recentOrders")}
        </h2>
        <Link to="/app/sales" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
          {t("dashboard.desk.viewAll")}
          <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </div>
      {orders.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-text-muted">{t("dashboard.desk.noOrdersYet")}</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-bold uppercase tracking-wide text-text-muted">
              <th className="px-5 py-2.5 font-bold">{t("dashboard.desk.customer")}</th>
              <th className="px-3 py-2.5 font-bold">{t("dashboard.desk.items")}</th>
              <th className="px-3 py-2.5 font-bold">{t("dashboard.desk.status")}</th>
              <th className="px-5 py-2.5 text-right font-bold">{t("dashboard.desk.amount")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {orders.map((order) => (
              <tr key={order.id}>
                <td className="px-5 py-3">
                  <p className="font-semibold text-text">{order.customerName}</p>
                  <p className="text-xs text-text-muted">
                    {new Date(order.createdAt).toLocaleDateString(locale, { day: "numeric", month: "short" })}
                  </p>
                </td>
                <td className="px-3 py-3 tabular-nums text-text">{order.itemCount}</td>
                <td className="px-3 py-3">
                  <span className={clsx("rounded-full px-2.5 py-1 text-xs font-bold", statusTone[order.status] ?? statusTone.pending)}>
                    {t(`dashboard.mobileDashboard.statusLabel.${order.status}`)}
                  </span>
                </td>
                <td className="px-5 py-3 text-right font-bold tabular-nums text-text">{formatCurrency(order.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

// ---------- Top products ----------

function TopProducts({ products }: { products: DashboardSummary["topProducts"] }) {
  const { t } = useTranslation();
  const maxRevenue = Math.max(1, ...products.map((p) => p.revenue));
  return (
    <section className="rounded-2xl border border-border bg-surface p-5 shadow-elevation-1" aria-labelledby="top-products">
      <h2 id="top-products" className="text-base font-bold text-text">
        {t("dashboard.desk.topProducts")}
      </h2>
      {products.length === 0 ? (
        <p className="mt-6 text-center text-sm text-text-muted">{t("dashboard.desk.noProductSales")}</p>
      ) : (
        <ol className="mt-4 space-y-3.5">
          {products.map((product, i) => (
            <li key={product.productId}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="flex min-w-0 items-baseline gap-2">
                  <span className="text-xs font-bold tabular-nums text-text-muted">{i + 1}.</span>
                  <span className="truncate text-sm font-semibold text-text">{product.name}</span>
                </span>
                <span className="shrink-0 text-sm font-bold tabular-nums text-text">{formatCurrency(product.revenue)}</span>
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-variant">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${(product.revenue / maxRevenue) * 100}%` }} />
                </div>
                <span className="shrink-0 text-xs font-medium tabular-nums text-text-muted">
                  {t("dashboard.desk.unitsSold", { count: product.quantity })}
                </span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

// ---------- Page ----------

export function DashboardPage() {
  const updateUser = useAuthStore((state) => state.updateUser);

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: getProfile,
  });

  const { data: summary } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: getDashboardSummary,
    // Keeps today's numbers current while the dashboard stays open at the counter.
    refetchInterval: 60_000,
  });

  useEffect(() => {
    if (!profile) return;
    updateUser({ name: profile.name, email: profile.email, tenantId: profile.tenant?.tenantId ?? null });
  }, [profile, updateUser]);

  return (
    <>
      <div className="lg:hidden">
        <MobileDashboard
          aiLayout={profile?.tenant?.aiDashboardLayout}
          summary={summary}
          businessName={profile?.tenant?.businessName}
        />
      </div>
      <DesktopDashboard
        ownerName={profile?.name}
        businessName={profile?.tenant?.businessName}
        aiLayout={profile?.tenant?.aiDashboardLayout}
        summary={summary}
      />
    </>
  );
}

function DesktopDashboard({
  ownerName,
  businessName,
  aiLayout,
  summary,
}: {
  ownerName?: string;
  businessName?: string;
  aiLayout?: AiDashboardLayout | null;
  summary?: DashboardSummary;
}) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const openNewSale = useNewSaleModalStore((state) => state.openModal);
  const openNewOrder = useNewOrderModalStore((state) => state.openModal);
  const language = i18n.resolvedLanguage ?? "en";
  const today = new Date().toLocaleDateString(dateLocale(language), { weekday: "long", day: "numeric", month: "long" });
  const firstName = ownerName?.split(" ")[0];

  const munshiNote = summary
    ? [
        t("dashboard.dashboardPage.fallbackSummarySales", { amount: formatCurrency(summary.todaySales) }),
        summary.lowStockCount > 0
          ? t(
              summary.lowStockCount === 1
                ? "dashboard.dashboardPage.fallbackSummaryLowStockOne"
                : "dashboard.dashboardPage.fallbackSummaryLowStockOther",
              { count: summary.lowStockCount }
            )
          : t("dashboard.dashboardPage.fallbackSummaryNoLowStock"),
        summary.topOverdueCustomerName
          ? t("dashboard.dashboardPage.fallbackSummaryOverdue", {
              name: summary.topOverdueCustomerName,
              amount: formatCurrency(summary.topOverdueAmount),
            })
          : t("dashboard.dashboardPage.fallbackSummaryNoOverdue"),
      ].join(" ")
    : t("dashboard.dashboardPage.loadingSummary");

  const quickActions = [
    { key: "sale", label: t("dashboard.desk.newSale"), icon: ReceiptText, onClick: openNewSale, primary: true },
    { key: "order", label: t("dashboard.desk.newOrder"), icon: ShoppingCart, onClick: openNewOrder },
    { key: "product", label: t("dashboard.desk.addProduct"), icon: PackagePlus, onClick: () => navigate("/app/inventory/new") },
    { key: "customer", label: t("dashboard.desk.addCustomer"), icon: UserPlus, onClick: () => navigate("/app/customers") },
  ];

  return (
    <div className="hidden space-y-6 lg:block">
      {/* Greeting + the day's most common actions */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-text-muted">
            <CalendarDays size={15} className="text-icon" aria-hidden="true" />
            {today}
          </p>
          <p className="mt-1 text-xl font-bold text-text">
            {firstName ? t("dashboard.desk.greeting", { name: firstName }) : t("dashboard.desk.greetingNoName")}
            {businessName ? <span className="font-semibold text-text-muted"> · {businessName}</span> : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {quickActions.map((action) => (
            <button
              key={action.key}
              type="button"
              onClick={action.onClick}
              className={clsx(
                "inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/40",
                action.primary
                  ? "bg-primary text-on-primary hover:bg-primary-hover"
                  : "border border-border bg-surface text-text hover:border-primary/50 hover:text-primary"
              )}
            >
              <action.icon size={17} aria-hidden="true" />
              {action.label}
            </button>
          ))}
        </div>
      </div>

      {/* Headline numbers — each opens the page to act on it */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <KpiCard
          label={t("dashboard.desk.todaysSales")}
          value={formatCurrency(summary?.todaySales ?? 0)}
          tone="primary"
          icon={<IndianRupee size={18} />}
          to="/app/sales"
          detail={
            <span className="flex flex-wrap items-center gap-x-2">
              <span>{t("dashboard.desk.bills", { count: summary?.todayOrderCount ?? 0 })}</span>
              <span aria-hidden="true">·</span>
              <SalesChange percent={summary?.salesChangePercent} />
            </span>
          }
        />
        <KpiCard
          label={t("dashboard.desk.thisMonth")}
          value={formatCurrency(summary?.monthSales ?? 0)}
          tone="success"
          icon={<CalendarDays size={18} />}
          to="/app/reports"
          detail={t("dashboard.desk.inventoryWorth", { amount: formatCurrency(summary?.inventoryValue ?? 0) })}
        />
        <KpiCard
          label={t("dashboard.desk.toCollect")}
          value={formatCurrency(summary?.receivables ?? 0)}
          tone="danger"
          icon={<Wallet size={18} />}
          to="/app/customers"
          detail={
            summary && summary.overdueCustomerCount > 0
              ? t("dashboard.desk.fromCustomers", { count: summary.overdueCustomerCount })
              : t("dashboard.desk.nothingDue")
          }
        />
        <KpiCard
          label={t("dashboard.desk.lowStock")}
          value={String(summary?.lowStockCount ?? 0)}
          tone="warning"
          icon={<AlertTriangle size={18} />}
          to="/app/inventory"
          detail={t("dashboard.desk.ofProducts", { count: summary?.totalSkus ?? 0 })}
        />
      </div>

      {/* Trend + today's to-do list */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <SalesTrendChart data={summary?.salesTrend ?? []} weekSales={summary?.weekSales ?? 0} language={language} />
        </div>
        <NeedsAttention summary={summary} businessName={businessName} />
      </div>

      {/* Orders, best sellers, Munshi's note */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <RecentOrders orders={summary?.recentOrders ?? []} language={language} />
        </div>
        <div className="space-y-4">
          <TopProducts products={summary?.topProducts ?? []} />
          <section className="rounded-2xl border border-primary/25 bg-primary-container p-5" aria-labelledby="munshi-note">
            <h2 id="munshi-note" className="flex items-center gap-2 text-base font-bold text-on-primary-container">
              <Sparkles size={17} className="text-icon" aria-hidden="true" />
              {t("dashboard.desk.munshiNote")}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-text">{aiLayout?.welcomeMessage ?? munshiNote}</p>
            <Link
              to="/app/ai"
              className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-on-primary-container hover:underline"
            >
              {t("dashboard.desk.askMunshi")}
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </section>
        </div>
      </div>
    </div>
  );
}
