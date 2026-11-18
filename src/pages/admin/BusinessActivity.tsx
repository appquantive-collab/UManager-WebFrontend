import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { LoadingRows, StatusPill } from "../../components/page/kit";
import { getBusinessActivity } from "../../lib/admin-api";
import { BarChart, BreakdownList, ChartCard } from "./charts";
import { adminDate, inr, rupees, shortDay, shortMonth } from "./admin-format";

const useActivity = (tenantId: string) => useQuery({ queryKey: ["admin-businesses", "activity", tenantId], queryFn: () => getBusinessActivity(tenantId) });

/** A business's last 30 days in the app: sales by day, top items, recent bills and purchases. Read-only. */
export function BusinessWork({ tenantId }: { tenantId: string }) {
  const { t } = useTranslation();
  const { data: a } = useActivity(tenantId);
  if (!a) return <LoadingRows rows={5} />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {([
          ["bills", String(a.totals30.bills)],
          ["sales", rupees(a.totals30.sales)],
          ["purchases", rupees(a.totals30.purchases)],
          ["activeDays", `${a.totals30.activeDays}/30`],
        ] as const).map(([key, value]) => (
          <div key={key} className="rounded-xl border border-border px-3 py-2.5">
            <p className="truncate text-xs text-text-muted">{t(`admin.work.${key}`)}</p>
            <p className="truncate text-base font-bold tabular-nums text-text">{value}</p>
          </div>
        ))}
      </div>

      <ChartCard title={t("admin.work.salesByDay")} subtitle={t("admin.work.last30")}>
        <BarChart
          caption={t("admin.work.salesByDay")}
          format={rupees}
          height={120}
          data={a.daily.map((d) => ({ key: d.day, label: shortDay(d.day), value: d.sales, tip: `${shortDay(d.day)} · ${rupees(d.sales)} · ${t("admin.growth.tipBills", { count: d.bills })}` }))}
        />
      </ChartCard>

      {a.topItems.length > 0 ? (
        <ChartCard title={t("admin.work.topItems")} subtitle={t("admin.work.last30")}>
          <BreakdownList rows={a.topItems.map((i) => ({ key: i.name, label: i.name, value: i.amount, display: rupees(i.amount), sub: `${i.qty} ${i.unit}` }))} />
        </ChartCard>
      ) : null}

      <section className="rounded-2xl border border-border">
        <p className="border-b border-border px-4 py-3 text-xs font-semibold uppercase tracking-wide text-text-muted">{t("admin.work.recentBills")}</p>
        {a.recentBills.length === 0 ? (
          <p className="px-4 py-3 text-sm text-text-muted">{t("admin.work.noBills")}</p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {a.recentBills.map((b) => (
              <li key={b.invoiceNumber + b.createdAt} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                <span className="min-w-0">
                  <span className="font-semibold text-text">{b.invoiceNumber}</span>
                  <span className="text-text-muted"> · {b.customer ?? t("admin.work.counter")} · {adminDate(b.createdAt)}</span>
                </span>
                <span className="flex items-center gap-2">
                  <span className={b.cancelled ? "tabular-nums text-text-muted line-through" : "font-semibold tabular-nums text-text"}>{rupees(b.total)}</span>
                  <StatusPill tone={b.cancelled ? "neutral" : b.paymentStatus === "paid" ? "success" : "danger"}>
                    {b.cancelled ? t("admin.work.cancelled") : t(`admin.work.pay.${b.paymentStatus}`)}
                  </StatusPill>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {a.recentPurchases.length > 0 ? (
        <section className="rounded-2xl border border-border">
          <p className="border-b border-border px-4 py-3 text-xs font-semibold uppercase tracking-wide text-text-muted">{t("admin.work.recentPurchases")}</p>
          <ul className="divide-y divide-border text-sm">
            {a.recentPurchases.map((p) => (
              <li key={p.purchaseNumber} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                <span className="min-w-0">
                  <span className="font-semibold text-text">{p.purchaseNumber}</span>
                  <span className="text-text-muted"> · {p.supplier ?? "—"} · {adminDate(p.purchasedAt)}</span>
                </span>
                <span className="font-semibold tabular-nums text-text">{rupees(p.total)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

/** What this business's AI use costs, in rupees: this month by kind of work, and the last 6 months. */
export function BusinessAiCost({ tenantId }: { tenantId: string }) {
  const { t } = useTranslation();
  const { data: a } = useActivity(tenantId);
  if (!a) return <LoadingRows rows={4} />;
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">{t("admin.costs.thisMonth")}</p>
        <p className="mt-1 text-2xl font-extrabold tabular-nums text-text">{inr(a.ai.thisMonthInr)}</p>
        {a.ai.estimatedInr > 0 ? <p className="text-xs text-text-muted">{t("admin.costs.estimatedPart", { amount: inr(a.ai.estimatedInr) })}</p> : null}
      </div>
      <ChartCard title={t("admin.costs.byKind")} subtitle={t("admin.costs.thisMonth")}>
        {a.ai.byKind.length === 0 ? (
          <p className="text-sm text-text-muted">{t("admin.costs.none")}</p>
        ) : (
          <BreakdownList rows={a.ai.byKind.map((k) => ({ key: k.kind, label: t(`admin.kind.${k.kind}`), value: k.inr, display: inr(k.inr), sub: t("admin.costs.calls", { count: k.calls }) }))} />
        )}
      </ChartCard>
      <ChartCard title={t("admin.costs.byMonth")} subtitle={a.ai.byMonth.some((m) => m.estimated) ? t("admin.costs.byMonthEstimated") : undefined}>
        <BarChart
          caption={t("admin.costs.byMonth")}
          format={inr}
          height={110}
          data={a.ai.byMonth.map((m) => ({ key: m.month, label: shortMonth(m.month), value: m.inr, tip: `${shortMonth(m.month)} · ${inr(m.inr)}${m.estimated ? ` (${t("admin.costs.estimate")})` : ""}` }))}
        />
      </ChartCard>
    </div>
  );
}
