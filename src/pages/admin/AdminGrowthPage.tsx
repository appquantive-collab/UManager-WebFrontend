import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { BadgePercent, CreditCard, IndianRupee, Store } from "lucide-react";
import { LoadingRows, SummaryTile } from "../../components/page/kit";
import { getAdminGrowth } from "../../lib/admin-api";
import { BarChart, BreakdownList, ChartCard } from "./charts";
import { rupees, shortDay, shortMonth } from "./admin-format";

/** Product growth: sign-ups, businesses actually using the app, money through it, revenue, feature use. */
export function AdminGrowthPage() {
  const { t } = useTranslation();
  const growth = useQuery({ queryKey: ["admin-growth"], queryFn: getAdminGrowth });
  const g = growth.data;
  const weekLabel = (w: string) => t("admin.growth.weekOf", { date: shortDay(w) });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[1.625rem] font-bold tracking-tight text-text">{t("admin.growth.title")}</h1>
        <p className="text-sm text-text-muted">{t("admin.growth.subtitle")}</p>
      </div>
      {!g ? (
        <LoadingRows rows={6} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <SummaryTile icon={Store} label={t("admin.growth.businesses")} value={String(g.totals.businesses)} />
            <SummaryTile icon={CreditCard} label={t("admin.growth.paidEver")} value={String(g.totals.paidEver)} />
            <SummaryTile icon={BadgePercent} label={t("admin.growth.conversion")} value={`${g.totals.conversionPct}%`} detail={t("admin.growth.conversionHint", { count: g.totals.trialOver })} />
            <SummaryTile icon={IndianRupee} label={t("admin.growth.revenueAll")} value={rupees(g.totals.revenueAllTime)} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title={t("admin.growth.signups")} subtitle={t("admin.growth.last12Weeks")}>
              <BarChart
                caption={t("admin.growth.signups")}
                format={(v) => String(v)}
                data={g.weekly.map((w) => ({ key: w.week, label: shortDay(w.week), value: w.signups, tip: `${weekLabel(w.week)} · ${t("admin.growth.tipSignups", { count: w.signups })}` }))}
              />
            </ChartCard>
            <ChartCard title={t("admin.growth.active")} subtitle={t("admin.growth.activeHint")}>
              <BarChart
                caption={t("admin.growth.active")}
                format={(v) => String(v)}
                data={g.weekly.map((w) => ({ key: w.week, label: shortDay(w.week), value: w.activeBusinesses, tip: `${weekLabel(w.week)} · ${t("admin.growth.tipActive", { count: w.activeBusinesses })}` }))}
              />
            </ChartCard>
            <ChartCard title={t("admin.growth.gmv")} subtitle={t("admin.growth.gmvHint")}>
              <BarChart
                caption={t("admin.growth.gmv")}
                format={rupees}
                data={g.weekly.map((w) => ({ key: w.week, label: shortDay(w.week), value: w.gmv, tip: `${weekLabel(w.week)} · ${rupees(w.gmv)} · ${t("admin.growth.tipBills", { count: w.bills })}` }))}
              />
            </ChartCard>
            <ChartCard title={t("admin.growth.revenue")} subtitle={t("admin.growth.revenueHint")}>
              <BarChart
                caption={t("admin.growth.revenue")}
                format={rupees}
                data={g.revenue.map((m) => ({ key: m.month, label: shortMonth(m.month), value: m.inr, tip: `${shortMonth(m.month)} · ${rupees(m.inr)} · ${t("admin.growth.tipPayments", { count: m.payments })}` }))}
              />
            </ChartCard>
          </div>

          <ChartCard title={t("admin.growth.adoption")} subtitle={t("admin.growth.adoptionHint")}>
            <BreakdownList
              rows={g.adoption.map((a) => ({
                key: a.key,
                label: t(`admin.growth.features.${a.key}`),
                value: a.pct,
                display: `${a.pct}%`,
                sub: t("admin.growth.ofBusinesses", { count: a.count, total: g.totals.businesses }),
              }))}
            />
          </ChartCard>
        </>
      )}
    </div>
  );
}
