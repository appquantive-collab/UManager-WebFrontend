import { useQuery } from "@tanstack/react-query";
import { getProfile, type PlanState } from "./auth-api";

/** Path of the plan screen (Settings → Plan). */
export const PLAN_PATH = "/app/settings?tab=plan";

/**
 * The business's plan from the profile. While the profile loads (or on an old
 * server without plans) everything stays open, so nothing flickers locked.
 */
export function usePlan(): PlanState & { loaded: boolean; platformAdmin: boolean } {
  const { data } = useQuery({ queryKey: ["profile"], queryFn: getProfile, staleTime: 60_000 });
  const sub = data?.tenant?.subscription;
  return {
    plan: sub?.plan ?? null,
    period: sub?.period ?? null,
    status: sub?.status ?? "trial",
    isPro: sub ? sub.isPro : true,
    endsAt: sub?.endsAt ?? null,
    daysLeft: sub?.daysLeft ?? 0,
    aiTokenLimit: sub?.aiTokenLimit ?? 0,
    loaded: Boolean(sub),
    platformAdmin: Boolean(data?.platformAdmin),
  };
}
