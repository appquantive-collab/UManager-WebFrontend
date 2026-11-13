import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Check, Sparkles } from "lucide-react";
import clsx from "clsx";
import { Button } from "../ui/Button";
import { SegmentedControl } from "../ui/SegmentedControl";
import { LoadingRows, StatusPill } from "../page/kit";
import { getBilling, startCheckout, verifyPayment, type PlanInfo } from "../../lib/billing-api";
import type { BillingPeriod, PlanKey, PlanState } from "../../lib/auth-api";
import { openRazorpay } from "../../lib/razorpay-checkout";
import { useAuthStore } from "../../lib/auth-store";
import { formatCurrency } from "../../lib/format";
import { errorMessage } from "../../lib/api-errors";
import { showError, showSuccess } from "../../lib/toast";

const PERIODS: BillingPeriod[] = ["monthly", "quarterly", "annual"];
const FEATURE_KEYS: Record<PlanKey, string[]> = {
  basic: ["allCrm", "aiTokens", "noLimits", "support"],
  pro: ["everythingBasic", "aiTokens", "advancedStock", "orderReading", "aiInsights", "importExport"],
};

function dateLabel(iso: string | null, locale: string) {
  return iso ? new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" }) : "";
}

/** Which plan, how long it runs, AI tokens this month, and buying / renewing. */
export function PlanSettings() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const role = useAuthStore((s) => s.user?.role);
  const canPay = role === "OWNER" || role === "SUPER_ADMIN";
  const locale = i18n.resolvedLanguage === "hi" ? "hi-IN" : "en-IN";
  const billing = useQuery({ queryKey: ["billing"], queryFn: getBilling });
  const [period, setPeriod] = useState<BillingPeriod>("annual");

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["billing"] });
    queryClient.invalidateQueries({ queryKey: ["profile"] });
  };

  const pay = useMutation({
    mutationFn: async (plan: PlanKey) => {
      const order = await startCheckout({ plan, period });
      const color = getComputedStyle(document.documentElement).getPropertyValue("--color-primary").trim() || "#bb4413";
      const result = await openRazorpay(order, { description: `${t(`plan.name.${plan}`)} · ${t(`plan.period.${period}`)}`, color });
      if (result.status !== "paid") return result;
      const { state } = await verifyPayment({ orderId: result.orderId, paymentId: result.paymentId, signature: result.signature });
      return { status: "paid" as const, state };
    },
    onSuccess: (result) => {
      if (result.status === "paid" && "state" in result) {
        refresh();
        showSuccess(t("plan.paidToast", { plan: t(`plan.name.${result.state.plan ?? "basic"}`), date: dateLabel(result.state.endsAt, locale) }));
      } else if (result.status === "failed") {
        showError(t("plan.payFailed"));
      }
    },
    onError: (err) => {
      refresh();
      showError(errorMessage(err, t));
    },
  });

  if (billing.isLoading || !billing.data) {
    return (
      <div className="max-w-3xl rounded-2xl border border-border bg-surface p-5 sm:p-6">
        <LoadingRows rows={4} />
      </div>
    );
  }
  const data = billing.data;
  const { state, usage } = data;
  const usedPct = usage.limit > 0 ? Math.min(100, Math.round((usage.used / usage.limit) * 100)) : 100;

  return (
    <div className="max-w-3xl space-y-5">
      <CurrentPlan state={state} locale={locale} />

      <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <Sparkles size={18} className="mt-0.5 shrink-0 text-icon" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-base font-bold text-text">{t("plan.aiTitle")}</h3>
              <p className="text-sm font-semibold tabular-nums text-text">
                {t("plan.aiUsed", { used: usage.used.toLocaleString("en-IN"), limit: usage.limit.toLocaleString("en-IN") })}
              </p>
            </div>
            <div
              className="mt-2 h-2 overflow-hidden rounded-full bg-surface-variant"
              role="progressbar"
              aria-valuenow={usedPct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={t("plan.aiTitle")}
            >
              <div className={clsx("h-full rounded-full", usedPct >= 100 ? "bg-danger" : "bg-primary")} style={{ width: `${usedPct}%` }} />
            </div>
            <p className="mt-2 text-xs text-text-muted">{usedPct >= 100 ? t("plan.aiUsedUp") : t("plan.aiHint")}</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-text">{t("plan.chooseTitle")}</h3>
            <p className="text-sm text-text-muted">{t("plan.chooseBody")}</p>
          </div>
          <SegmentedControl
            className="w-full sm:w-auto"
            segments={PERIODS.map((p) => {
              const off = data.plans[0]?.prices.find((x) => x.period === p)?.discountPercent ?? 0;
              return { key: p, label: off ? `${t(`plan.period.${p}`)} −${off}%` : t(`plan.period.${p}`) };
            })}
            active={period}
            onChange={(k) => setPeriod(k as BillingPeriod)}
          />
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {data.plans.map((plan) => (
            <PlanCard
              key={plan.key}
              plan={plan}
              period={period}
              state={state}
              canPay={canPay && data.onlinePayments}
              paying={pay.isPending && pay.variables === plan.key}
              disabled={pay.isPending}
              onPay={() => pay.mutate(plan.key)}
            />
          ))}
        </div>

        {!data.onlinePayments ? (
          <p className="mt-4 rounded-xl bg-surface-muted px-4 py-3 text-sm text-text">{t("plan.offlineNote")}</p>
        ) : !canPay ? (
          <p className="mt-4 rounded-xl bg-surface-muted px-4 py-3 text-sm text-text">{t("plan.ownerPays")}</p>
        ) : (
          <p className="mt-4 text-xs text-text-muted">{t("plan.payNote")}</p>
        )}
      </section>

      {data.payments.length > 0 ? (
        <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
          <h3 className="text-base font-bold text-text">{t("plan.historyTitle")}</h3>
          <ul className="mt-3 divide-y divide-border">
            {data.payments.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <div className="min-w-0">
                  <p className="font-semibold text-text">
                    {t(`plan.name.${p.plan}`)} · {p.period ? t(`plan.period.${p.period}`) : t("plan.days", { count: p.days ?? 0 })}
                  </p>
                  <p className="text-xs text-text-muted">
                    {dateLabel(p.paidAt, locale)} · {p.method === "manual" ? t("plan.byTeam") : t("plan.online")}
                    {p.periodEnd ? ` · ${t("plan.until", { date: dateLabel(p.periodEnd, locale) })}` : ""}
                  </p>
                </div>
                <span className="font-semibold tabular-nums text-text">{formatCurrency(p.amount)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function CurrentPlan({ state, locale }: { state: PlanState; locale: string }) {
  const { t } = useTranslation();
  const name = state.status === "trial" ? t("plan.trialName") : t(`plan.name.${state.plan ?? "basic"}`);
  return (
    <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">{t("plan.currentLabel")}</p>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <h3 className="text-xl font-bold text-text">{state.status === "expired" && !state.plan ? t("plan.trialName") : name}</h3>
        {state.status === "expired" ? (
          <StatusPill tone="danger">{t("plan.status.expired")}</StatusPill>
        ) : state.status === "trial" ? (
          <StatusPill tone="neutral">{t("plan.status.trial")}</StatusPill>
        ) : (
          <StatusPill tone="success">{t("plan.status.active")}</StatusPill>
        )}
      </div>
      <p className="mt-1 text-sm text-text-muted">
        {state.status === "trial"
          ? t("plan.trialBody", { count: state.daysLeft, date: dateLabel(state.endsAt, locale) })
          : state.status === "active"
            ? t("plan.activeBody", { count: state.daysLeft, date: dateLabel(state.endsAt, locale) })
            : t("plan.expiredBody", { date: dateLabel(state.endsAt, locale) })}
      </p>
    </section>
  );
}

function PlanCard({
  plan,
  period,
  state,
  canPay,
  paying,
  disabled,
  onPay,
}: {
  plan: PlanInfo;
  period: BillingPeriod;
  state: PlanState;
  canPay: boolean;
  paying: boolean;
  disabled: boolean;
  onPay: () => void;
}) {
  const { t } = useTranslation();
  const price = plan.prices.find((p) => p.period === period);
  if (!price) return null;
  const perMonth = Math.round(price.price / price.months);
  const isCurrent = state.status === "active" && state.plan === plan.key;
  const highlight = plan.key === "pro";
  return (
    <div className={clsx("flex flex-col rounded-2xl p-5", highlight ? "border-2 border-primary" : "border border-border")}>
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-lg font-bold text-text">{t(`plan.name.${plan.key}`)}</h4>
        {isCurrent ? <StatusPill tone="success">{t("plan.current")}</StatusPill> : highlight ? <StatusPill tone="primary">{t("plan.popular")}</StatusPill> : null}
      </div>
      <p className="mt-0.5 text-sm text-text-muted">{t(`plan.tagline.${plan.key}`)}</p>
      <div className="mt-4 flex flex-wrap items-baseline gap-x-2">
        <span className="text-3xl font-bold tabular-nums text-text">{formatCurrency(price.price)}</span>
        {price.months > 1 ? <span className="text-sm text-text-muted line-through tabular-nums">{formatCurrency(price.fullPrice)}</span> : null}
      </div>
      <p className="text-sm text-text-muted">
        {price.months > 1
          ? t("plan.perMonthEquiv", { amount: formatCurrency(perMonth), months: price.months, save: formatCurrency(price.fullPrice - price.price) })
          : t("plan.perMonth")}
      </p>
      <ul className="mt-4 flex-1 space-y-2">
        {FEATURE_KEYS[plan.key].map((key) => (
          <li key={key} className="flex items-start gap-2 text-sm text-text">
            <Check size={16} className="mt-0.5 shrink-0 text-icon" aria-hidden="true" />
            {t(`plan.features.${plan.key}.${key}`, { tokens: plan.aiTokensPerMonth.toLocaleString("en-IN") })}
          </li>
        ))}
      </ul>
      {canPay ? (
        <Button className="mt-5 w-full" variant={highlight ? "primary" : "secondary"} isLoading={paying} disabled={disabled} onClick={onPay}>
          {isCurrent ? t("plan.renew", { amount: formatCurrency(price.price) }) : t("plan.choose", { plan: t(`plan.name.${plan.key}`), amount: formatCurrency(price.price) })}
        </Button>
      ) : null}
    </div>
  );
}
