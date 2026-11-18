import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { CalendarDays, IndianRupee, Store, UserRoundX } from "lucide-react";
import { FilterChips, LoadingRows, SummaryTile } from "../../components/page/kit";
import { getAdminCosts } from "../../lib/admin-api";
import { BusinessDetailModal } from "./BusinessDetailModal";
import { BarChart, BreakdownList, ChartCard } from "./charts";
import { inr, shortDay, tokens } from "./admin-format";

const RANGES = ["7", "30", "90"] as const;

/** What AI costs VoiceMunshi in rupees: by day, by kind of work, by model, and the costliest businesses. */
export function AdminCostsPage() {
  const { t } = useTranslation();
  const [range, setRange] = useState<(typeof RANGES)[number]>("30");
  const [openId, setOpenId] = useState<string | null>(null);
  const costs = useQuery({ queryKey: ["admin-costs", range], queryFn: () => getAdminCosts(Number(range)) });
  const c = costs.data;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-text">{t("admin.costs.title")}</h1>
          <p className="text-sm text-text-muted">{t("admin.costs.subtitle")}</p>
        </div>
        <FilterChips label={t("admin.costs.range")} options={RANGES.map((key) => ({ key, label: t("admin.costs.days", { count: Number(key) }) }))} value={range} onChange={setRange} />
      </div>

      {!c ? (
        <LoadingRows rows={6} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <SummaryTile
              icon={IndianRupee}
              label={t("admin.costs.thisMonth")}
              value={inr(c.totals.thisMonthInr)}
              detail={c.totals.thisMonthEstimatedInr > 0 ? t("admin.costs.estimatedPart", { amount: inr(c.totals.thisMonthEstimatedInr) }) : t("admin.costs.lastMonth", { amount: inr(c.totals.lastMonthInr) })}
            />
            <SummaryTile icon={CalendarDays} label={t("admin.costs.inRange", { count: c.days })} value={inr(c.totals.rangeInr)} detail={t("admin.costs.calls", { count: c.totals.rangeCalls })} />
            <SummaryTile icon={Store} label={t("admin.costs.perBusiness")} value={inr(c.totals.perBusinessInr)} detail={t("admin.costs.perBusinessHint")} />
            <SummaryTile icon={UserRoundX} label={t("admin.costs.preLogin")} value={inr(c.totals.preLoginInr)} detail={t("admin.costs.preLoginHint")} />
          </div>

          <ChartCard title={t("admin.costs.perDay")} subtitle={t("admin.costs.perDayHint", { rate: c.pricing.usdToInr })}>
            <BarChart
              caption={t("admin.costs.perDay")}
              format={inr}
              data={c.byDay.map((d) => ({ key: d.day, label: shortDay(d.day), value: d.inr, tip: `${shortDay(d.day)} · ${inr(d.inr)} · ${t("admin.costs.calls", { count: d.calls })}` }))}
            />
          </ChartCard>

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title={t("admin.costs.byKind")}>
              {c.byKind.length === 0 ? (
                <p className="text-sm text-text-muted">{t("admin.costs.none")}</p>
              ) : (
                <BreakdownList
                  rows={c.byKind.map((k) => ({
                    key: k.kind,
                    label: t(`admin.kind.${k.kind}`),
                    value: k.inr,
                    display: inr(k.inr),
                    sub: [t("admin.costs.calls", { count: k.calls }), k.tokens ? t("admin.costs.tokens", { count: tokens(k.tokens) }) : null, k.audioMinutes ? t("admin.costs.minutes", { count: k.audioMinutes }) : null]
                      .filter(Boolean)
                      .join(" · "),
                  }))}
                />
              )}
            </ChartCard>

            <ChartCard title={t("admin.costs.topBusinesses")} subtitle={t("admin.costs.inRange", { count: c.days })}>
              {c.topBusinesses.length === 0 ? (
                <p className="text-sm text-text-muted">{t("admin.costs.none")}</p>
              ) : (
                <BreakdownList
                  rows={c.topBusinesses.map((b) => ({
                    key: b.tenantId,
                    label: (
                      <button type="button" onClick={() => setOpenId(b.tenantId)} className="font-semibold text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary/40">
                        {b.businessName}
                      </button>
                    ),
                    value: b.inr,
                    display: inr(b.inr),
                    sub: t("admin.costs.calls", { count: b.calls }),
                  }))}
                />
              )}
            </ChartCard>
          </div>

          <ChartCard title={t("admin.costs.byModel")} subtitle={t("admin.costs.byModelHint")}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[34rem] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-text-muted">
                    <th className="py-2 pr-3 font-semibold">{t("admin.costs.model")}</th>
                    <th className="py-2 pr-3 text-right font-semibold">{t("admin.costs.callsCol")}</th>
                    <th className="py-2 pr-3 text-right font-semibold">{t("admin.costs.inputTokens")}</th>
                    <th className="py-2 pr-3 text-right font-semibold">{t("admin.costs.outputTokens")}</th>
                    <th className="py-2 pr-3 text-right font-semibold">{t("admin.costs.audio")}</th>
                    <th className="py-2 text-right font-semibold">₹</th>
                  </tr>
                </thead>
                <tbody>
                  {c.byModel.map((m) => (
                    <tr key={m.provider + m.model} className="border-b border-border last:border-0">
                      <td className="py-2 pr-3 text-text">
                        {m.model}
                        <span className="ml-1.5 text-xs text-text-muted">{m.provider}</span>
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums text-text">{m.calls}</td>
                      <td className="py-2 pr-3 text-right tabular-nums text-text">{m.inputTokens || m.cachedTokens ? tokens(m.inputTokens + m.cachedTokens) : "—"}</td>
                      <td className="py-2 pr-3 text-right tabular-nums text-text">{m.outputTokens ? tokens(m.outputTokens) : "—"}</td>
                      <td className="py-2 pr-3 text-right tabular-nums text-text">{m.audioMinutes ? t("admin.costs.minutes", { count: m.audioMinutes }) : "—"}</td>
                      <td className="py-2 text-right font-semibold tabular-nums text-text">{inr(m.inr)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ChartCard>
        </>
      )}
      <BusinessDetailModal tenantId={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}
