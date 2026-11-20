import { NavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { AudioLines } from "lucide-react";
import { canSee, mobileBottomNav, type NavItem } from "../../lib/nav";
import { useAuthStore } from "../../lib/auth-store";
import { useAppSetup } from "../../lib/use-app-setup";
import { getDashboardSummary } from "../../lib/dashboard-api";

interface MobileBottomNavProps {
  /** Kept for the layout's create sheet; the dock itself no longer has a + button. */
  onQuickAction?: () => void;
  quickActionsOpen?: boolean;
}

// Phone dock: Home · Bikri · [Munshi voice] · Stock · Hisaab. The current tab sits
// in a soft orange pill; Munshi is the raised orange button in the middle.

function CountBadge({ count, tone }: { count: number; tone: "danger" | "warning" }) {
  if (count <= 0) return null;
  return (
    <span
      aria-hidden="true"
      className={clsx(
        "absolute -right-2.5 -top-1.5 flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full px-1 text-[0.6875rem] font-bold leading-none tabular-nums text-white ring-2 ring-surface",
        tone === "danger" ? "bg-danger" : "bg-warning"
      )}
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}

export function MobileBottomNav(_props: MobileBottomNavProps) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const role = useAuthStore((state) => state.user?.role);
  const { features } = useAppSetup();
  const navItems = mobileBottomNav.filter((item) => canSee(item, role, features));
  // Two tabs on each side of Munshi when there are four; otherwise as even as possible.
  const leftCount = Math.ceil(navItems.length / 2);
  const left = navItems.slice(0, leftCount);
  const right = navItems.slice(leftCount);

  // Live counts, shared with the dashboard's cached summary (refreshed at most once a minute).
  const { data: summary } = useQuery({ queryKey: ["dashboard-summary"], queryFn: getDashboardSummary, staleTime: 60_000 });
  const badgeFor = (path: string) => {
    if (path === "/app/sales" && summary?.pendingOrderCount)
      return { count: summary.pendingOrderCount, tone: "danger" as const, label: t("layout.navBadge.ordersToBill", { count: summary.pendingOrderCount }) };
    if (path === "/app/inventory" && summary?.lowStockCount)
      return { count: summary.lowStockCount, tone: "warning" as const, label: t("layout.navBadge.lowStock", { count: summary.lowStockCount }) };
    return null;
  };

  const isActive = (item: NavItem) => (item.path === "/app" ? pathname === "/app" || pathname === "/app/" : pathname.startsWith(item.path));

  const tab = (item: NavItem) => {
    const active = isActive(item);
    const badge = badgeFor(item.path);
    return (
      <NavLink
        key={item.path}
        to={item.path}
        end={item.path === "/app"}
        className="group flex min-w-0 flex-1 justify-center outline-none"
      >
        <span
          className={clsx(
            "flex min-w-[4.25rem] flex-col items-center gap-1 rounded-2xl px-2 py-1.5 transition-colors group-focus-visible:ring-2 group-focus-visible:ring-primary/40",
            active ? "bg-primary-container" : "group-active:bg-surface-muted"
          )}
        >
          <span className="relative flex items-center justify-center">
            <item.icon size={23} strokeWidth={active ? 2.1 : 1.8} className={active ? "text-primary" : "text-text-subtle"} aria-hidden="true" />
            {badge ? <CountBadge count={badge.count} tone={badge.tone} /> : null}
          </span>
          <span className={clsx("max-w-full truncate text-xs leading-none", active ? "font-bold text-primary" : "font-medium text-text-subtle")}>
            {t(item.labelKey)}
          </span>
        </span>
        {badge ? <span className="sr-only">{badge.label}</span> : null}
      </NavLink>
    );
  };

  return (
    <nav
      aria-label={t("layout.mainNavigation")}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-6px_20px_-12px_rgba(16,24,40,0.18)] backdrop-blur supports-[backdrop-filter]:bg-surface/90 lg:hidden"
    >
      {/* Full-width bar; the tabs stay a comfortable thumb-width apart on wide screens. */}
      <div className="relative mx-auto flex h-[4.5rem] w-full max-w-2xl items-center px-1">
        {left.map(tab)}

        {/* Munshi AI: the raised orange voice button. */}
        <div className="flex w-20 shrink-0 justify-center">
          <NavLink
            to="/app/ai"
            aria-label={t("nav.ai")}
            title={t("nav.ai")}
            className={({ isActive: onMunshi }) =>
              clsx(
                "relative -mt-9 flex h-16 w-16 items-center justify-center rounded-full bg-brand-gradient text-white shadow-brand ring-[5px] ring-surface outline-none",
                "transition-transform duration-200 active:scale-95 focus-visible:ring-primary/40",
                onMunshi && "scale-105"
              )
            }
          >
            <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-full bg-primary/40 opacity-0 motion-safe:animate-[munshi-halo_2.8s_ease-out_infinite]" />
            <AudioLines size={28} strokeWidth={2.2} className="relative" aria-hidden="true" />
          </NavLink>
        </div>

        {right.map(tab)}
      </div>
    </nav>
  );
}
