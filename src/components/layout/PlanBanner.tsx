import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import clsx from "clsx";
import { useAuthStore } from "../../lib/auth-store";
import { PLAN_PATH, usePlan } from "../../lib/use-plan";

const DISMISS_KEY = "sethsathi.planBannerDismissed";

/**
 * Top-of-page plan notice:
 * - plan/trial ended → solid red, can't be closed (the app is read-only);
 * - 5 days or fewer left → quiet reminder, can be closed for the day.
 */
export function PlanBanner() {
  const { t } = useTranslation();
  const location = useLocation();
  const role = useAuthStore((s) => s.user?.role);
  const canChoose = role === "OWNER" || role === "MANAGER" || role === "SUPER_ADMIN";
  const plan = usePlan();
  const today = new Date().toISOString().slice(0, 10);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === today;
    } catch {
      return false;
    }
  });

  if (!plan.loaded) return null;
  const onPlanPage = location.pathname === "/app/settings" && location.search.includes("tab=plan");
  const expired = plan.status === "expired";
  const endingSoon = !expired && plan.daysLeft <= 5;
  if ((!expired && !endingSoon) || (endingSoon && dismissed) || onPlanPage) return null;

  const text = expired
    ? canChoose
      ? t("planBanner.expired")
      : t("planBanner.expiredStaff")
    : plan.status === "trial"
      ? t("planBanner.trialEnding", { count: plan.daysLeft })
      : t("planBanner.planEnding", { count: plan.daysLeft });

  return (
    <div
      role={expired ? "alert" : "status"}
      className={clsx(
        "mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl px-4 py-3 text-sm",
        expired ? "bg-danger text-white" : "border border-border bg-surface text-text"
      )}
    >
      <p className="min-w-0 flex-1 font-semibold">{text}</p>
      {canChoose ? (
        <Link
          to={PLAN_PATH}
          className={clsx(
            "inline-flex h-9 items-center rounded-full px-4 text-sm font-bold outline-none focus-visible:ring-2",
            expired ? "bg-white text-danger focus-visible:ring-white/60" : "bg-primary text-on-primary focus-visible:ring-primary/40"
          )}
        >
          {t("planBanner.choose")}
        </Link>
      ) : null}
      {!expired ? (
        <button
          type="button"
          aria-label={t("common.close")}
          onClick={() => {
            setDismissed(true);
            try {
              localStorage.setItem(DISMISS_KEY, today);
            } catch {
              /* private mode: dismissed for this visit only */
            }
          }}
          className="flex h-9 w-9 items-center justify-center rounded-full text-icon outline-none hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <X size={16} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
