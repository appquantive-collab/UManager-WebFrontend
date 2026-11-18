import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Ban, Clock, CreditCard, IndianRupee, Sparkles, Store, Users, Wallet } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { SummaryTile, LoadingRows, StatusPill } from "../../components/page/kit";
import { getAdminCosts, getAdminGrowth, getAdminOverview } from "../../lib/admin-api";
import { BusinessDetailModal } from "./BusinessDetailModal";
import { adminDate, inr, rupees, tokens } from "./admin-format";

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-text">{t("admin.overview.title")}</h1>
        <p className="text-sm text-text-muted">{t("admin.overview.subtitle")}</p>
      </div>

      {!data ? (
        <LoadingRows rows={4} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <SummaryTile icon={Store} label={t("admin.overview.businesses")} value={String(data.businesses.total)} detail={t("admin.overview.newWeek", { count: data.businesses.week, today: data.businesses.today })} />
            <SummaryTile icon={Clock} label={t("admin.status.trial")} value={String(data.businesses.trial)} detail={t("admin.overview.expiredCount", { count: data.businesses.expired })} />
            <SummaryTile icon={CreditCard} label={t("admin.status.active")} value={String(data.businesses.paid)} detail={t("admin.overview.paidHint")} />
            <SummaryTile icon={Ban} label={t("admin.status.suspended")} value={String(data.businesses.suspended)} />
            <SummaryTile icon={Users} label={t("admin.overview.users")} value={String(data.users.total)} detail={t("admin.overview.activeWeek", { count: data.users.activeWeek })} />
            <SummaryTile icon={Sparkles} label={t("admin.overview.aiTokens")} value={tokens(data.ai.tokens)} detail={t("admin.overview.aiCalls", { count: data.ai.calls })} />
            <SummaryTile icon={IndianRupee} label={t("admin.overview.aiCost")} value={costs.data ? inr(costs.data.totals.thisMonthInr) : "…"} detail={costs.data ? t("admin.overview.aiCostPer", { amount: inr(costs.data.totals.perBusinessInr) }) : undefined} onClick={() => navigate("/admin/costs")} />
            <SummaryTile icon={Wallet} label={t("admin.overview.revenue")} value={growth.data ? rupees(revenueThisMonth) : "…"} detail={growth.data ? t("admin.overview.revenueAll", { amount: rupees(growth.data.totals.revenueAllTime) }) : undefined} onClick={() => navigate("/admin/growth")} />
          </div>

          {/* Sign-ups, last 14 days */}
          <section className="rounded-2xl border border-border bg-surface p-4 shadow-elevation-1">
            <h2 className="text-base font-bold text-text">{t("admin.overview.signups")}</h2>
            <div className="mt-4 flex h-32 items-end gap-1.5" role="list" aria-label={t("admin.overview.signups")}>
              {data.signups.map((d) => (
                <div key={d.date} role="listitem" className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1" aria-label={`${adminDate(d.date)}: ${d.count}`}>
                  <span className="text-[11px] font-semibold tabular-nums text-text-muted">{d.count || ""}</span>
                  <div className="w-full max-w-7 rounded-t-md bg-primary" style={{ height: `${Math.max(d.count ? 8 : 2, (d.count / maxSignups) * 88)}%`, opacity: d.count ? 1 : 0.25 }} />
                </div>
              ))}
            </div>
            <div className="mt-1.5 flex justify-between text-[11px] text-text-muted">
              <span>{adminDate(data.signups[0]?.date)}</span>
              <span>{t("admin.overview.today")}</span>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-surface shadow-elevation-1">
            <h2 className="border-b border-border px-4 py-3 text-base font-bold text-text">{t("admin.overview.recent")}</h2>
            <ul className="divide-y divide-border">
              {data.recent.map((b) => (
                <li key={b.tenantId}>
                  <button
                    type="button"
                    onClick={() => setOpenId(b.tenantId)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left outline-none hover:bg-surface-muted focus-visible:bg-surface-muted"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-text">{b.businessName}</span>
                      <span className="block truncate text-xs text-text-muted">
                        {b.ownerName ?? "—"} · {adminDate(b.createdAt)}
                      </span>
                    </span>
                    <StatusPill tone={b.status === "active" ? "success" : b.status === "trial" ? "neutral" : "danger"}>{t(`admin.status.${b.status}`)}</StatusPill>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
      <BusinessDetailModal tenantId={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}
