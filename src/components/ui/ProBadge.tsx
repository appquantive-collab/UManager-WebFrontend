import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import { PLAN_PATH, usePlan } from "../../lib/use-plan";
import { showInfo } from "../../lib/toast";

/** Small "PRO" tag next to a Pro-only control. */
export function ProBadge({ className }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <span className={clsx("inline-flex shrink-0 items-center rounded-full bg-primary px-1.5 py-0.5 text-[0.625rem] font-bold uppercase leading-none tracking-wide text-on-primary", className)}>
      {t("plan.proTag")}
    </span>
  );
}

/**
 * For Pro-only actions: `locked` is true on Basic (or after the plan ends).
 * `guard(fn)` runs fn when allowed; otherwise explains and opens the plan page.
 */
export function useProGate() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isPro } = usePlan();
  return {
    locked: !isPro,
    /** Just explains (for forms, where leaving the page would lose what was typed). */
    explain: () => showInfo(t("plan.proOnlyTitle"), t("plan.proOnlyBody")),
    guard: (fn: () => void) => {
      if (isPro) return fn();
      showInfo(t("plan.proOnlyTitle"), t("plan.proOnlyBody"));
      navigate(PLAN_PATH);
    },
  };
}
