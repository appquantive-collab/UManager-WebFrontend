import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowDownRight, ArrowUpRight, Package, Sparkles } from "lucide-react";
import { StatCard } from "../components/ui/StatCard";
import { IconChip } from "../components/ui/IconChip";
import { formatCurrency } from "../lib/format";
import { MobileDashboard } from "./dashboard/MobileDashboard";
import { getProfile, type AiDashboardLayout } from "../lib/auth-api";
import { getDashboardSummary, type DashboardSummary } from "../lib/dashboard-api";
import { useAuthStore } from "../lib/auth-store";

const productColors = ["#3b82f6", "#22c55e", "#f59e0b", "#a855f7", "#ef4444"];

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function SalesTrendChart({ label, data }: { label: string; data: { day: string; sales: number }[] }) {
  return (
    <div className="rounded-2xl bg-surface p-5 shadow-elevation-1">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-text">{label}</h2>
          <p className="mt-1 text-xs text-text-muted">Last 7 days</p>
        </div>
      </div>

      <div className="mt-4 h-56">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6d28d9" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#6d28d9" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
            <YAxis hide domain={[0, "dataMax + 1000"]} />
            <Tooltip
              contentStyle={{
                background: "#ffffff",
                border: "none",
                borderRadius: 12,
                fontSize: 12,
                color: "#0f172a",
                boxShadow: "0 12px 32px 0 rgba(15, 23, 42, 0.16)",
              }}
              formatter={(value) => [formatCurrency(Number(value)), "Sales"]}
              labelStyle={{ color: "#64748b" }}
            />
            <Area type="monotone" dataKey="sales" stroke="#6d28d9" strokeWidth={2.5} fill="url(#salesFill)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function TopProducts({ label, products }: { label: string; products: DashboardSummary["topProducts"] }) {
  const maxRevenue = Math.max(1, ...products.map((p) => p.revenue));

  return (
    <div className="rounded-2xl bg-surface p-5 shadow-elevation-1">
      <h2 className="text-sm font-semibold text-text">{label}</h2>
      {products.length === 0 ? (
        <p className="mt-4 text-sm text-text-muted">No sales yet — billed products will show up here.</p>
      ) : (
        <div className="mt-4 space-y-4">
          {products.map((product, i) => (
            <div key={product.productId} className="flex items-center gap-3">
              <IconChip color={productColors[i % productColors.length]}>
                <Package size={16} strokeWidth={1.75} />
              </IconChip>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium text-text">{product.name}</span>
                  <span className="shrink-0 text-sm text-text-muted">{formatCurrency(product.revenue)}</span>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-variant">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(product.revenue / maxRevenue) * 100}%`,
                      backgroundColor: productColors[i % productColors.length],
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RecentActivity({ label, activity }: { label: string; activity: DashboardSummary["recentActivity"] }) {
  return (
    <div className="rounded-2xl bg-surface shadow-elevation-1">
      <div className="px-5 py-4">
        <h2 className="text-sm font-semibold text-text">{label}</h2>
      </div>
      {activity.length === 0 ? (
        <p className="px-5 pb-5 text-sm text-text-muted">No activity yet.</p>
      ) : (
        <div className="divide-y divide-surface-variant">
          {activity.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="flex items-center gap-3">
                <IconChip color={item.amount >= 0 ? "#22c55e" : "#ef4444"}>
                  {item.amount >= 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                </IconChip>
                <div>
                  <div className="text-sm font-medium text-text">{item.description}</div>
                  <div className="text-xs text-text-muted">
                    {item.type} · {timeAgo(item.time)}
                  </div>
                </div>
              </div>
              <span className={item.amount >= 0 ? "text-sm font-medium text-success" : "text-sm font-medium text-danger"}>
                {item.amount >= 0 ? "+" : ""}
                {formatCurrency(item.amount)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function DashboardPage() {
  const updateUser = useAuthStore((state) => state.updateUser);

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: getProfile,
  });

  const { data: summary } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: getDashboardSummary,
  });

  useEffect(() => {
    if (!profile) return;
    updateUser({ name: profile.name, email: profile.email, tenantId: profile.tenant?.tenantId ?? null });
  }, [profile, updateUser]);

  return (
    <>
      <div className="lg:hidden">
        <MobileDashboard
          businessName={profile?.tenant?.businessName}
          aiLayout={profile?.tenant?.aiDashboardLayout}
          summary={summary}
          userName={profile?.name}
        />
      </div>
      <DesktopDashboard
        businessName={profile?.tenant?.businessName}
        aiLayout={profile?.tenant?.aiDashboardLayout}
        summary={summary}
      />
    </>
  );
}

function DesktopDashboard({
  businessName,
  aiLayout,
  summary,
}: {
  businessName?: string;
  aiLayout?: AiDashboardLayout | null;
  summary?: DashboardSummary;
}) {
  const labelFor = (key: string, fallback: string) =>
    aiLayout?.sections.find((s) => s.key === key)?.label || fallback;

  const salesHint =
    summary?.salesChangePercent != null
      ? `${summary.salesChangePercent >= 0 ? "+" : ""}${summary.salesChangePercent.toFixed(1)}% vs yesterday`
      : undefined;

  const receivablesHint =
    summary && summary.overdueCustomerCount > 0
      ? `${summary.overdueCustomerCount} customer${summary.overdueCustomerCount === 1 ? "" : "s"} overdue`
      : undefined;

  return (
    <div className="hidden space-y-6 lg:block">
      {businessName ? <p className="text-sm text-text-muted">Welcome back, {businessName}</p> : null}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Today's Sales" value={formatCurrency(summary?.todaySales ?? 0)} hint={salesHint} />
        <StatCard label="Today's Purchases" value={formatCurrency(summary?.todayPurchases ?? 0)} hint="Not tracked yet" />
        <StatCard label="Inventory Value" value={formatCurrency(summary?.inventoryValue ?? 0)} />
        <StatCard label="Receivables" value={formatCurrency(summary?.receivables ?? 0)} hint={receivablesHint} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SalesTrendChart label={labelFor("sales_trend", "Sales Trend")} data={summary?.salesTrend ?? []} />
        </div>
        <TopProducts label={labelFor("top_products", "Top Products")} products={summary?.topProducts ?? []} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RecentActivity label={labelFor("recent_activity", "Recent Activity")} activity={summary?.recentActivity ?? []} />
        </div>
        <div className="rounded-2xl bg-surface p-5 shadow-elevation-1">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-primary" />
            <h2 className="text-sm font-semibold text-text">AI Business Summary</h2>
          </div>
          <p className="mt-3 text-sm text-text-muted">
            {aiLayout?.welcomeMessage ??
              (summary
                ? `Today's sales are ${formatCurrency(summary.todaySales)}. ${
                    summary.lowStockCount > 0
                      ? `${summary.lowStockCount} product${summary.lowStockCount === 1 ? " is" : "s are"} below reorder level.`
                      : "No products are below reorder level."
                  } ${
                    summary.topOverdueCustomerName
                      ? `${summary.topOverdueCustomerName} has ${formatCurrency(summary.topOverdueAmount)} overdue.`
                      : "No overdue payments."
                  }`
                : "Loading your business summary…")}
          </p>
        </div>
      </div>
    </div>
  );
}
