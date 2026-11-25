import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Ban, BarChart3, CalendarDays, Clock, CreditCard, IndianRupee, Sparkles, Store, Users, Wallet } from "lucide-react";
import { useNavigate } from "react-router-dom";
import clsx from "clsx";
import { LoadingRows, StatusPill } from "../../components/page/kit";
import { getAdminCosts, getAdminGrowth, getAdminOverview } from "../../lib/admin-api";
import { BusinessDetailModal } from "./BusinessDetailModal";
import { adminDate, inr, rupees, tokens } from "./admin-format";
import { AdminCard, PageHeader, StatCard, td, th } from "./admin-ui";

export function AdminOverviewPage() {
  const { t } = useTranslation();
  const [openId, setOpenId] = useState<string | null>(null);
  const navigate = useNavigate();
  const overview = useQuery({ queryKey: ["admin-overview"], queryFn: getAdminOverview });
  const costs = useQuery({ queryKey: ["admin-costs", "30"], queryFn: () => getAdminCosts(30) });
  const growth = useQuery({ queryKey: ["admin-growth"], queryFn: getAdminGrowth });
  const revenueThisMonth = growth.data?.revenue.at(-1)?.inr ?? 0;
  const data = overview.data;
  const maxSignups = Math.max(1, ...(data?.signups ?? []).map((d) => d.count));
  const peak = data?.signups.reduce((best, d) => (d.count > (best?.count ?? -1) ? d : best), data.signups[0]);
  const today = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("admin.overview.title")}
        subtitle={t("admin.overview.subtitle")}
        actions={
          <span className="flex h-10 items-center gap-2 rounded-xl border border-border bg-surface px-3.5 text-sm font-medium text-text shadow-card">
            <CalendarDays size={16} className="text-icon" aria-hidden="true" />
            {today}
          </span>
        }
      />

      {!data ? (
        <LoadingRows rows={4} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <StatCard icon={Store} label={t("admin.overview.businesses")} value={String(data.businesses.total)} detail={t("admin.overview.newWeek", { count: data.businesses.week, today: data.businesses.today })} trend={data.businesses.week > 0 ? { text: `+${data.businesses.week} this week`, up: true } : null} onClick={() => navigate("/admin/businesses")} />
            <StatCard icon={Clock} label={t("admin.status.trial")} value={String(data.businesses.trial)} detail={t("admin.overview.expiredCount", { count: data.businesses.expired })} />
            <StatCard icon={CreditCard} label={t("admin.status.active")} value={String(data.businesses.paid)} detail={t("admin.overview.paidHint")} />
            <StatCard icon={Ban} label={t("admin.status.suspended")} value={String(data.businesses.suspended)} />
            <StatCard icon={Users} label={t("admin.overview.users")} value={String(data.users.total)} detail={t("admin.overview.activeWeek", { count: data.users.activeWeek })} onClick={() => navigate("/admin/users")} />
            <StatCard icon={Sparkles} label={t("admin.overview.aiTokens")} value={tokens(data.ai.tokens)} detail={t("admin.overview.aiCalls", { count: data.ai.calls })} />
            <StatCard icon={IndianRupee} label={t("admin.overview.aiCost")} value={costs.data ? inr(costs.data.totals.thisMonthInr) : "…"} detail={costs.data ? t("admin.overview.aiCostPer", { amount: inr(costs.data.totals.perBusinessInr) }) : undefined} onClick={() => navigate("/admin/costs")} />
            <StatCard icon={Wallet} label={t("admin.overview.revenue")} value={growth.data ? rupees(revenueThisMonth) : "…"} detail={growth.data ? t("admin.overview.revenueAll", { amount: rupees(growth.data.totals.revenueAllTime) }) : undefined} onClick={() => navigate("/admin/growth")} />
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            {/* Sign-ups, last 14 days */}
            <AdminCard title={t("admin.overview.signups")} icon={BarChart3} right={<span className="text-xs font-medium text-text-muted">Last 14 days</span>}>
              <div className="flex h-56 items-end gap-2" role="list" aria-label={t("admin.overview.signups")}>
                {data.signups.map((d) => {
                  const isPeak = d === peak && d.count > 0;
                  return (
                    <div key={d.date} role="listitem" className="group relative flex h-full min-w-0 flex-1 flex-col items-center justify-end" aria-label={`${adminDate(d.date)}: ${d.count}`}>
                      <span className={clsx("mb-1 text-[11px] font-semibold tabular-nums", isPeak ? "text-primary" : "text-text-muted")}>{d.count || ""}</span>
                      <div
                        className={clsx("w-full max-w-9 rounded-lg transition-colors", isPeak ? "bg-primary" : d.count ? "bg-primary/25 group-hover:bg-primary/45" : "bg-surface-variant")}
                        style={{ height: `${Math.max(d.count ? 8 : 4, (d.count / maxSignups) * 86)}%` }}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 flex justify-between text-xs text-text-muted">
                <span>{adminDate(data.signups[0]?.date)}</span>
                <span>{t("admin.overview.today")}</span>
              </div>
            </AdminCard>

            {/* Newest businesses */}
            <AdminCard title={t("admin.overview.recent")} icon={Store} bodyClassName="px-0 pb-2 pt-3" right={
              <button type="button" onClick={() => navigate("/admin/businesses")} className="text-xs font-semibold text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary/40">
                View all
              </button>
            }>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-surface-muted">
                      <th className={th}>Business</th>
                      <th className={clsx(th, "text-right")}>Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.recent.map((b) => (
                      <tr
                        key={b.tenantId}
                        tabIndex={0}
                        onClick={() => setOpenId(b.tenantId)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") setOpenId(b.tenantId);
                        }}
                        className="cursor-pointer outline-none hover:bg-primary-container/40 focus-visible:bg-primary-container/50"
                      >
                        <td className={td}>
                          <span className="block max-w-[15rem] truncate font-semibold">{b.businessName}</span>
                          <span className="block max-w-[15rem] truncate text-xs text-text-muted">
                            {b.ownerName ?? "—"} · {adminDate(b.createdAt)}
                          </span>
                        </td>
                        <td className={clsx(td, "text-right")}>
                          <StatusPill tone={b.status === "active" ? "success" : b.status === "trial" ? "neutral" : "danger"}>{t(`admin.status.${b.status}`)}</StatusPill>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </AdminCard>
          </div>
        </>
      )}
      <BusinessDetailModal tenantId={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}
