import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { LoadingRows, StatusPill } from "../../components/page/kit";
import { getBusinessActivity } from "../../lib/admin-api";
import { BarChart, BreakdownList, ChartCard } from "./charts";
import { adminDate, inr, lastSeen, rupees, shortDay, shortMonth } from "./admin-format";

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
  const allow = a.ai.allowance;
  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-2xl border border-border p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Today</p>
          {allow.unlimited ? (
            <p className="mt-1 text-lg font-bold text-text">{t("admin.business.aiUnlimited")}</p>
          ) : (
            <>
              <p className={`mt-1 text-2xl font-extrabold tabular-nums ${allow.exhausted ? "text-danger" : "text-text"}`}>{allow.todayPct}%</p>
              <p className="text-xs text-text-muted">
                {inr(allow.todayInr)} of {inr(allow.dailyInr)} a day{allow.exhausted ? " · used up, refills at midnight" : ""}
              </p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-variant" aria-hidden="true">
                <div className={`h-full rounded-full ${allow.exhausted ? "bg-danger" : "bg-primary"}`} style={{ width: `${allow.todayPct}%` }} />
              </div>
            </>
          )}
        </div>
        <div className="rounded-2xl border border-border p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">{t("admin.costs.thisMonth")}</p>
          <p className="mt-1 text-2xl font-extrabold tabular-nums text-text">{inr(a.ai.thisMonthInr)}</p>
          <p className="text-xs text-text-muted">
            {allow.unlimited ? "No budget (unlimited)" : `of ${inr(allow.monthlyInr)} budget · ${allow.monthPct}%`}
            {a.ai.estimatedInr > 0 ? ` · ${t("admin.costs.estimatedPart", { amount: inr(a.ai.estimatedInr) })}` : ""}
          </p>
        </div>
      </div>

      <ChartCard title="AI per day" subtitle={allow.unlimited ? "Last 30 days" : `Last 30 days · allowance ${inr(allow.dailyInr)} a day`}>
        <BarChart
          caption="AI per day"
          format={inr}
          height={110}
          data={a.ai.daily.map((d) => ({
            key: d.day,
            label: shortDay(d.day),
            value: d.inr,
            tip: `${shortDay(d.day)} · ${inr(d.inr)} · ${d.calls} calls${!allow.unlimited && allow.dailyInr > 0 ? ` · ${Math.round((d.inr / allow.dailyInr) * 100)}% of allowance` : ""}`,
          }))}
        />
      </ChartCard>

      {a.ai.byUser.length > 0 ? (
        <ChartCard title="By login" subtitle={t("admin.costs.thisMonth")}>
          <BreakdownList rows={a.ai.byUser.map((u) => ({ key: u.userId ?? "none", label: u.name, value: u.inr, display: inr(u.inr), sub: t("admin.costs.calls", { count: u.calls }) }))} />
        </ChartCard>
      ) : null}
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

      {a.ai.recentCalls.length > 0 ? (
        <section className="rounded-2xl border border-border">
          <p className="border-b border-border px-4 py-3 text-xs font-semibold uppercase tracking-wide text-text-muted">Latest AI calls</p>
          <ul className="divide-y divide-border text-sm">
            {a.ai.recentCalls.map((c, i) => (
              <li key={i} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
                <span className="min-w-0">
                  <span className="text-text">{t(`admin.kind.${c.kind}`)}</span>
                  <span className="text-text-muted">
                    {" "}
                    · {c.user ?? "—"} · {lastSeen(c.at)}
                    {c.detail ? ` · ${c.detail}` : ""}
                  </span>
                </span>
                <span className="shrink-0 tabular-nums text-text-muted">
                  {inr(c.inr)} · {c.model}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

/** Who did what in this business (bills, payments, cancellations, changes), newest first. Read-only. */
export function BusinessActivityLog({ tenantId }: { tenantId: string }) {
  const { data: a } = useActivity(tenantId);
  if (!a) return <LoadingRows rows={5} />;
  if (a.activity.length === 0) return <p className="text-sm text-text-muted">No activity recorded yet.</p>;
  return (
    <ul className="divide-y divide-border rounded-2xl border border-border text-sm">
      {a.activity.map((e, i) => (
        <li key={i} className="px-4 py-2.5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-semibold text-text">{e.user}</span>
            <span className="text-xs tabular-nums text-text-muted">
              {adminDate(e.at)} · {lastSeen(e.at)}
            </span>
          </div>
          <p className="text-text">{e.summary}</p>
          <p className="text-xs text-text-muted">{e.action}</p>
        </li>
      ))}
    </ul>
  );
}
