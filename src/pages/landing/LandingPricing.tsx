import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import clsx from "clsx";
import { SegmentedControl } from "../../components/ui/SegmentedControl";
import { FALLBACK_PRICES, getPriceList } from "../../lib/billing-api";
import type { BillingPeriod, PlanKey } from "../../lib/auth-api";
import { formatCurrency } from "../../lib/format";

const PERIODS: BillingPeriod[] = ["monthly", "quarterly", "annual"];
const FEATURE_KEYS: Record<PlanKey, string[]> = {
  basic: ["allCrm", "aiTokens", "noLimits", "support"],
  pro: ["everythingBasic", "aiTokens", "advancedStock", "orderReading", "aiInsights", "importExport"],
};

/** Basic and Pro, monthly / quarterly / annual — the same prices the app charges. */
export function LandingPricing() {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<BillingPeriod>("annual");
  const { data } = useQuery({ queryKey: ["price-list"], queryFn: getPriceList, staleTime: 3_600_000 });
  const prices = data ?? FALLBACK_PRICES;

  return (
    <section id="pricing" className="mx-auto max-w-290 px-4 py-20 sm:py-28">
      <div className="mx-auto max-w-2xl text-center">
        <span className="text-xs font-semibold uppercase tracking-wider text-primary">{t("landing.pricing.eyebrow")}</span>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-text sm:text-4xl">{t("landing.pricing.heading")}</h2>
        <p className="mt-3 text-base text-text-muted">{t("landing.pricing.trialNote", { days: prices.trialDays })}</p>
      </div>

      <div className="mt-8 flex justify-center">
        <SegmentedControl
          className="w-full max-w-md"
          segments={PERIODS.map((p) => {
            const off = prices.plans[0]?.prices.find((x) => x.period === p)?.discountPercent ?? 0;
            return { key: p, label: off ? `${t(`plan.period.${p}`)} −${off}%` : t(`plan.period.${p}`) };
          })}
          active={period}
          onChange={(k) => setPeriod(k as BillingPeriod)}
        />
      </div>

      <div className="mx-auto mt-8 grid max-w-4xl grid-cols-1 gap-5 md:grid-cols-2">
        {prices.plans.map((plan) => {
          const price = plan.prices.find((p) => p.period === period);
          if (!price) return null;
          const highlighted = plan.key === "pro";
          return (
            <div
              key={plan.key}
              className={clsx(
                "relative flex flex-col rounded-3xl bg-surface p-7",
                highlighted ? "border-2 border-primary shadow-elevation-3" : "border border-border shadow-elevation-1"
              )}
            >
              {highlighted ? (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-on-primary">
                  {t("landing.pricing.mostPopular")}
                </span>
              ) : null}
              <h3 className="text-lg font-semibold text-text">{t(`plan.name.${plan.key}`)}</h3>
              <p className="mt-1 text-sm text-text-muted">{t(`plan.tagline.${plan.key}`)}</p>
              <div className="mt-5 flex flex-wrap items-baseline gap-x-2">
                <span className="text-3xl font-bold tabular-nums text-text">{formatCurrency(price.price)}</span>
                {price.months > 1 ? <span className="text-sm tabular-nums text-text-muted line-through">{formatCurrency(price.fullPrice)}</span> : null}
              </div>
              <p className="text-sm text-text-muted">
                {price.months > 1
                  ? t("plan.perMonthEquiv", {
                      amount: formatCurrency(Math.round(price.price / price.months)),
                      months: price.months,
                      save: formatCurrency(price.fullPrice - price.price),
                    })
                  : t("plan.perMonth")}
              </p>
              <ul className="mt-6 flex-1 space-y-3">
                {FEATURE_KEYS[plan.key].map((key) => (
                  <li key={key} className="flex items-start gap-2 text-sm text-text-muted">
                    <Check size={16} className="mt-0.5 shrink-0 text-icon" aria-hidden="true" />
                    {t(`plan.features.${plan.key}.${key}`, { tokens: plan.aiTokensPerMonth.toLocaleString("en-IN") })}
                  </li>
                ))}
              </ul>
              <Link
                to="/register"
                className={
                  highlighted
                    ? "mt-7 flex h-11 items-center justify-center rounded-full bg-primary text-sm font-semibold text-on-primary shadow-elevation-1 transition-colors hover:bg-primary-hover"
                    : "mt-7 flex h-11 items-center justify-center rounded-full border border-border text-sm font-semibold text-text transition-colors hover:bg-surface-muted"
                }
              >
                {t("landing.pricing.startTrial", { days: prices.trialDays })}
              </Link>
            </div>
          );
        })}
      </div>
    </section>
  );
}
