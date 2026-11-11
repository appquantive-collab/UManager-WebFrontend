import { Fragment, useLayoutEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { Plus, Sparkles } from "lucide-react";
import { canSee, mobileBottomNav } from "../../lib/nav";
import { useAuthStore } from "../../lib/auth-store";
import { getDashboardSummary } from "../../lib/dashboard-api";
import { useDisplayStore } from "../../lib/display-settings";

interface MobileBottomNavProps {
  onQuickAction: () => void;
  quickActionsOpen: boolean;
}

// "Liquid glass" dock: a frosted capsule (Home · Sales · + Create · Stock · Staff)
// plus a separate round, glossy Munshi AI button. The current tab sits in a white glass pill that shows its label; when
// you switch, the pill stretches across to the new tab like liquid, then settles.
// With Large/Extra-large text (Settings → Display) every tab shows its label.

type Rect = { x: number; w: number };

const STRETCH_MS = 150;

function CountBadge({ count, tone }: { count: number; tone: "danger" | "warning" }) {
  if (count <= 0) return null;
  return (
    <span
      aria-hidden="true"
      className={clsx(
        "absolute -right-2.5 -top-1.5 flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full px-1 text-[0.6875rem] font-bold leading-none tabular-nums text-white ring-2 ring-white/80",
        tone === "danger" ? "bg-danger" : "bg-warning"
      )}
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function MobileBottomNav({ onQuickAction, quickActionsOpen }: MobileBottomNavProps) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const role = useAuthStore((state) => state.user?.role);
  const navItems = mobileBottomNav.filter((item) => canSee(item, role));
  const textSize = useDisplayStore((state) => state.textSize);
  const showAllLabels = textSize === "large" || textSize === "xlarge";

  const activeIndex = navItems.findIndex((item) =>
    item.path === "/app" ? pathname === "/app" || pathname === "/app/" : pathname.startsWith(item.path)
  );

  // Live counts, shared with the dashboard's cached summary (refreshed at most once a minute).
  const { data: summary } = useQuery({ queryKey: ["dashboard-summary"], queryFn: getDashboardSummary, staleTime: 60_000 });
  const badgeFor = (path: string) => {
    if (path === "/app/sales" && summary?.pendingOrderCount)
      return { count: summary.pendingOrderCount, tone: "danger" as const, label: t("layout.navBadge.ordersToBill", { count: summary.pendingOrderCount }) };
    if (path === "/app/inventory" && summary?.lowStockCount)
      return { count: summary.lowStockCount, tone: "warning" as const, label: t("layout.navBadge.lowStock", { count: summary.lowStockCount }) };
    return null;
  };

  // ---- The sliding glass pill ----
  const barRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [pill, setPill] = useState<Rect | null>(null);
  const [stretching, setStretching] = useState(false);
  const stretchingRef = useRef(false);
  const lastIndex = useRef(activeIndex);

  const rectOf = (index: number): Rect | null => {
    const el = tabRefs.current[index];
    return el ? { x: el.offsetLeft, w: el.offsetWidth } : null;
  };

  // Follow the active tab while labels open/close and on resize. Every tab is
  // watched: when the old tab's label closes, the active tab *moves* without
  // changing size, and the pill must move with it.
  useLayoutEffect(() => {
    if (activeIndex < 0 || !barRef.current) return;
    const follow = () => {
      if (!stretchingRef.current) setPill(rectOf(activeIndex));
    };
    const observer = new ResizeObserver(follow);
    observer.observe(barRef.current);
    for (const tab of tabRefs.current) if (tab) observer.observe(tab);
    return () => observer.disconnect();
  }, [activeIndex, showAllLabels]);

  // On a tab change: stretch from the old tab to the new one, then settle.
  useLayoutEffect(() => {
    const from = lastIndex.current;
    lastIndex.current = activeIndex;
    const to = rectOf(activeIndex);
    if (activeIndex < 0 || !to) {
      setPill(null);
      return;
    }
    const start = from >= 0 ? rectOf(from) : null;
    if (!start || from === activeIndex || prefersReducedMotion()) {
      setPill(to);
      return;
    }
    const left = Math.min(start.x, to.x);
    const right = Math.max(start.x + start.w, to.x + to.w);
    stretchingRef.current = true;
    setStretching(true);
    setPill({ x: left, w: right - left });
    const timer = window.setTimeout(() => {
      stretchingRef.current = false;
      setStretching(false);
      setPill(rectOf(activeIndex));
    }, STRETCH_MS);
    return () => window.clearTimeout(timer);
  }, [activeIndex]);

  return (
    <nav
      aria-label={t("layout.mainNavigation")}
      className={clsx(
        // Above the Create sheet only while it is open (so its × can close it); otherwise
        // below popups and forms, which must never have their buttons covered.
        "pointer-events-none fixed inset-x-0 bottom-0 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden",
        quickActionsOpen ? "z-[60]" : "z-40"
      )}
    >
      <div className="pointer-events-auto mx-auto flex max-w-md items-center gap-2.5">
        {/* Frosted capsule (falls back to near-solid white where blur isn't supported). */}
        <div
          ref={barRef}
          className={clsx(
            "relative flex h-16 flex-1 items-center justify-between rounded-full border border-white/70 p-1.5",
            "bg-surface/95 supports-[backdrop-filter]:bg-surface/75 backdrop-blur-xl backdrop-saturate-[1.15]",
            "shadow-[0_12px_32px_-12px_rgba(59,31,18,0.30),inset_0_1px_0_rgba(255,255,255,0.95),inset_0_-1px_0_rgba(255,255,255,0.35)]"
          )}
        >
          {/* Top sheen for the glass look. */}
          <span aria-hidden="true" className="pointer-events-none absolute inset-x-5 top-0 h-1/2 rounded-t-full bg-gradient-to-b from-white/50 to-transparent" />

          {/* The white glass pill behind the current tab. */}
          {pill ? (
            <span
              aria-hidden="true"
              className={clsx(
                "absolute inset-y-1.5 left-0 rounded-full border border-border/60 bg-surface",
                "shadow-[0_3px_12px_-3px_rgba(59,31,18,0.22),inset_0_1px_0_rgba(255,255,255,1)]",
                "motion-reduce:transition-none",
                stretching
                  ? "transition-[transform,width] duration-150 ease-out"
                  : "transition-[transform,width] duration-300 ease-[cubic-bezier(0.34,1.4,0.64,1)]"
              )}
              style={{ transform: `translateX(${pill.x}px)`, width: pill.w }}
            />
          ) : null}

          {navItems.map((item, index) => {
            const active = index === activeIndex;
            // Create (+) sits in the middle of the capsule, right after Sales.
            const createButton =
              index === 2 ? (
                <button
                  type="button"
                  onClick={onQuickAction}
                  aria-haspopup="dialog"
                  aria-expanded={quickActionsOpen}
                  aria-label={quickActionsOpen ? t("layoutExtra.quickActionSheet.close") : t("quickActions.create")}
                  className={clsx(
                    "relative z-10 flex h-full shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40",
                    showAllLabels ? "flex-1 flex-col gap-0.5 px-1" : "px-3.5"
                  )}
                >
                  <Plus
                    size={showAllLabels ? 22 : 25}
                    strokeWidth={1.9}
                    aria-hidden="true"
                    className={clsx(
                      "transition-transform duration-300 ease-[cubic-bezier(0.34,1.4,0.64,1)] active:scale-90 motion-reduce:transition-none",
                      quickActionsOpen ? "rotate-45 text-text" : "text-icon"
                    )}
                  />
                  {showAllLabels ? <span className="text-xs font-medium leading-none text-text-muted">{t("quickActions.create")}</span> : null}
                </button>
              ) : null;
            const badge = badgeFor(item.path);
            const labelVisible = active || showAllLabels;
            return (
              <Fragment key={item.path}>
              {createButton}
              <NavLink
                ref={(el) => {
                  tabRefs.current[index] = el;
                }}
                to={item.path}
                end={item.path === "/app"}
                className={clsx(
                  "relative z-10 flex h-full shrink-0 items-center justify-center rounded-full outline-none transition-[padding] duration-300 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40",
                  showAllLabels ? "flex-1 flex-col gap-0.5 px-1" : clsx("gap-2", active ? "px-4" : "px-3.5")
                )}
              >
                <span className="relative flex items-center justify-center transition-transform active:scale-90">
                  <item.icon
                    size={showAllLabels ? 21 : 23}
                    strokeWidth={active ? 2.1 : 1.75}
                    className={active ? "text-text" : "text-icon"}
                    aria-hidden="true"
                  />
                  {badge ? <CountBadge count={badge.count} tone={badge.tone} /> : null}
                </span>
                <span
                  className={clsx(
                    "overflow-hidden whitespace-nowrap leading-none transition-[max-width,opacity] duration-300",
                    showAllLabels ? "text-xs" : "text-sm",
                    active ? "font-bold text-text" : "font-medium text-text-muted",
                    labelVisible ? "max-w-[7rem] opacity-100" : "max-w-0 opacity-0"
                  )}
                >
                  {t(item.labelKey)}
                </span>
                {badge ? <span className="sr-only">{badge.label}</span> : null}
              </NavLink>
              </Fragment>
            );
          })}
        </div>

        {/* Round glossy Munshi AI button: opens the assistant from anywhere. */}
        <NavLink
          to="/app/ai"
          aria-label={t("nav.ai")}
          title={t("nav.ai")}
          className={({ isActive }) =>
            clsx(
              "relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border text-white outline-none",
              "bg-[linear-gradient(150deg,#ef7a45_0%,#d4572a_45%,#b23c0e_100%)]",
              "shadow-[0_12px_26px_-10px_rgba(178,60,14,0.65),inset_0_1px_1px_rgba(255,255,255,0.6),inset_0_-2px_6px_rgba(120,30,0,0.25)]",
              "transition-transform duration-200 active:scale-95 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2",
              // On the Munshi AI screen: a white ring shows it's the current place.
              isActive ? "border-white ring-2 ring-primary/50 ring-offset-2 ring-offset-background" : "border-white/50"
            )
          }
        >
          <span aria-hidden="true" className="pointer-events-none absolute inset-x-2.5 top-1 h-[45%] rounded-full bg-gradient-to-b from-white/45 to-white/0" />
          <Sparkles size={27} strokeWidth={2} aria-hidden="true" className="relative" />
        </NavLink>
      </div>
    </nav>
  );
}
