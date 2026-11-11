import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";

const plans = [
  { key: "starter", highlighted: false },
  { key: "business", highlighted: true },
  { key: "enterprise", highlighted: false },
] as const;

export function LandingPricing() {
  const { t } = useTranslation();

  return (
    <section id="pricing" className="mx-auto max-w-290 px-4 py-20 sm:py-28">
      <div className="mx-auto max-w-2xl text-center">
        <span className="text-xs font-semibold uppercase tracking-wider text-primary">{t("landing.pricing.eyebrow")}</span>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-text sm:text-4xl">
          {t("landing.pricing.heading")}
        </h2>
      </div>

      <div className="mt-14 grid grid-cols-1 gap-5 lg:grid-cols-3">
        {plans.map((plan) => {
          const features = t(`landing.pricing.plans.${plan.key}.features`, {
            returnObjects: true,
          }) as string[];

          return (
            <div
              key={plan.key}
              className={
                plan.highlighted
                  ? "relative rounded-3xl border-2 border-primary bg-surface p-7 shadow-elevation-3"
                  : "relative rounded-3xl border border-border bg-surface p-7 shadow-elevation-1"
              }
            >
              {plan.highlighted && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-on-primary">
                  {t("landing.pricing.mostPopular")}
                </span>
              )}
              <h3 className="text-lg font-semibold text-text">{t(`landing.pricing.plans.${plan.key}.name`)}</h3>
              <p className="mt-1 text-sm text-text-muted">{t(`landing.pricing.plans.${plan.key}.description`)}</p>
              <div className="mt-5 text-3xl font-bold text-text">{t(`landing.pricing.plans.${plan.key}.price`)}</div>
              <ul className="mt-6 space-y-3">
                {features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-text-muted">
                    <Check size={16} className="mt-0.5 shrink-0 text-icon" aria-hidden="true" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Link
                to="/register"
                className={
                  plan.highlighted
                    ? "mt-7 flex h-11 items-center justify-center rounded-full bg-primary text-sm font-semibold text-on-primary shadow-elevation-1 transition-colors hover:bg-primary-hover"
                    : "mt-7 flex h-11 items-center justify-center rounded-full border border-border text-sm font-semibold text-text transition-colors hover:bg-surface-muted"
                }
              >
                {t("landing.pricing.getStarted")}
              </Link>
            </div>
          );
        })}
      </div>
    </section>
  );
}
