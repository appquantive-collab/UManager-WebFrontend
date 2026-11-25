import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { AudioLines, ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { canSee, tenantNav } from "../lib/nav";
import { useAppSetup } from "../lib/use-app-setup";
import { PLAN_PATH, usePlan } from "../lib/use-plan";
import { useAuthStore } from "../lib/auth-store";
import { getPageMeta } from "../lib/pageMeta";
import { getProfile } from "../lib/auth-api";
import { Avatar } from "../components/ui/Avatar";
import { MobileBottomNav } from "../components/layout/MobileBottomNav";
import { MobileTopBar } from "../components/layout/MobileTopBar";
import { QuickActionSheet } from "../components/layout/QuickActionSheet";
import { PlanBanner } from "../components/layout/PlanBanner";
import { UserMenu } from "../components/layout/UserMenu";
import { NotificationsMenu } from "../components/layout/NotificationsMenu";
import { OnboardingModal } from "../components/onboarding/OnboardingModal";
import { FeatureTour, tourSeen } from "../components/tour/FeatureTour";
import { NewOrderModal } from "../components/orders/NewOrderModal";
import { NewSaleModal } from "../components/orders/NewSaleModal";
import { NewPurchaseModal } from "../components/purchases/NewPurchaseModal";
import { AddCustomerModal } from "../components/customers/AddCustomerModal";
import { AddExpenseModal } from "../components/cashbook/AddExpenseModal";
import { useNewOrderModalStore } from "../lib/new-order-store";
import { useNewSaleModalStore } from "../lib/new-sale-store";
import { ChatLive } from "../components/chat/ChatLive";
import { CHAT_ROLES, getUnreadTotal } from "../lib/chat-api";
import { chatKeys } from "../lib/chat-cache";

const ONBOARDING_SKIPPED_KEY = "umanager.onboarding-skipped";

// Full-page forms (not modals) get their own Cancel/Save actions, so the
// global FAB and bottom nav would only sit on top of the form with nothing
// useful to add — hide them on these routes instead of the usual pages.
const FULL_PAGE_FORM_PATTERNS = [
  /^\/app\/inventory\/new$/,
  /^\/app\/inventory\/[^/]+\/edit$/,
  /^\/app\/staff\/new$/,
  /^\/app\/staff\/[^/]+\/edit$/,
];

function isFullPageForm(pathname: string): boolean {
  return FULL_PAGE_FORM_PATTERNS.some((pattern) => pattern.test(pathname));
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

export function TenantAdminLayout() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  // Desktop: text a step larger inside the app (see .app-root in index.css).
  useEffect(() => {
    document.documentElement.classList.add("app-root");
    return () => document.documentElement.classList.remove("app-root");
  }, []);
  const user = useAuthStore((state) => state.user);
  const { features: appFeatures, vocab } = useAppSetup();
  const plan = usePlan();
  const clearSession = useAuthStore((state) => state.clearSession);
  const updateUser = useAuthStore((state) => state.updateUser);
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [addCustomerOpen, setAddCustomerOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const queryClient = useQueryClient();
  const newOrderOpen = useNewOrderModalStore((state) => state.open);
  const openNewOrder = useNewOrderModalStore((state) => state.openModal);
  const closeNewOrder = useNewOrderModalStore((state) => state.closeModal);
  const newSaleOpen = useNewSaleModalStore((state) => state.open);
  const openNewSale = useNewSaleModalStore((state) => state.openModal);
  const closeNewSale = useNewSaleModalStore((state) => state.closeModal);
  // Skipping setup is remembered per business, so a new account in the same tab still gets the wizard.
  const [dismissedFor, setDismissedFor] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(ONBOARDING_SKIPPED_KEY);
    } catch {
      return null;
    }
  });

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: getProfile,
  });

  useEffect(() => {
    if (!profile) return;
    updateUser({ name: profile.name, email: profile.email, tenantId: profile.tenant?.tenantId ?? null, role: profile.role });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  // Only the owner sets the business up; staff logins never see the setup wizard.
  const tenantId = profile?.tenant?.tenantId ?? null;
  const showOnboarding =
    Boolean(profile) && profile?.role === "OWNER" && !profile?.tenant?.onboarding.completed && (tenantId === null || dismissedFor !== tenantId);

  // New login on this device: a short tour of what Munshi does (after the setup wizard, never on top of it).
  const [tourClosed, setTourClosed] = useState(false);
  const showTour = Boolean(profile) && !showOnboarding && !tourClosed && !tourSeen(profile?.userId);

  // Back after a while (30 min+): open Munshi with a greeting, like opening a chat.
  // Only when the app opens on its home screen, so a shared link still goes where it points.
  useEffect(() => {
    const KEY = "voicemunshi.lastActiveAt";
    const GAP_MS = 30 * 60 * 1000;
    const read = () => {
      try {
        return Number(localStorage.getItem(KEY) || 0);
      } catch {
        return 0;
      }
    };
    const write = () => {
      try {
        localStorage.setItem(KEY, String(Date.now()));
      } catch {
        // Without storage there's simply no greeting.
      }
    };
    const maybeGreet = () => {
      const last = read();
      const path = window.location.pathname.replace(/\/+$/, "");
      if (last && Date.now() - last > GAP_MS && tourSeen(useAuthStore.getState().user?.userId) && (path === "/app" || path === "/app/ai")) {
        navigate("/app/ai", { state: { greet: Date.now() } });
      }
      write();
    };
    maybeGreet();
    const onVisibility = () => (document.visibilityState === "visible" ? maybeGreet() : write());
    document.addEventListener("visibilitychange", onVisibility);
    const timer = window.setInterval(write, 60_000);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dismissOnboarding = () => {
    try {
      if (tenantId) sessionStorage.setItem(ONBOARDING_SKIPPED_KEY, tenantId);
    } catch {
      // Private mode: skipping still works until the page reloads.
    }
    setDismissedFor(tenantId);
  };

  // Navigating on a phone should dismiss the drawer, not leave it covering the page.
  useEffect(() => {
    setDrawerOpen(false);
    setQuickActionsOpen(false);
  }, [location.pathname]);

  // Ctrl+K / Cmd+K anywhere, or "/" when not typing, opens Search.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.closest("input, textarea, select, [contenteditable='true']");
      if (((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") || (event.key === "/" && !typing)) {
        event.preventDefault();
        navigate("/app/search");
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [navigate]);

  const handleLogout = () => {
    clearSession();
    navigate("/login", { replace: true });
  };

  const chatAllowed = Boolean(user?.role && (CHAT_ROLES as readonly string[]).includes(user.role));
  const chatUnread = useQuery({ queryKey: chatKeys.unread, queryFn: getUnreadTotal, enabled: chatAllowed, refetchInterval: 120_000 }).data?.total ?? 0;
  const { title, subtitle } = getPageMeta(location.pathname, vocab);
  const visibleNav = tenantNav.filter((item) => canSee(item, user?.role, appFeatures));
  // Chat: full-height page; an open chat on a phone hides the app bars (it has its own header and input).
  const canChat = chatAllowed;
  const chatRoute = location.pathname.startsWith("/app/chats");
  const chatOpen = /^\/app\/chats\/[^/]+$/.test(location.pathname);
  const hideMobileBars = isFullPageForm(location.pathname) || chatOpen;
  const navGroups = (["main", "sell", "stock", "money", "manage"] as const)
    .map((group) => ({ group, items: visibleNav.filter((item) => (item.group ?? "main") === group) }))
    .filter((g) => g.items.length > 0);
  const planLine =
    plan.status === "trial"
      ? t("layout.planTrial", { count: plan.daysLeft })
      : plan.status === "expired"
        ? t("layout.planEnded")
        : t(`plan.name.${plan.plan ?? "basic"}`) + " · " + t("layout.planDays", { count: plan.daysLeft });

  return (
    <div className="flex h-dvh overflow-hidden bg-background lg:bg-surface-muted">
      {drawerOpen && (
        <button
          type="button"
          aria-label={t("layout.closeNavigation")}
          onClick={() => setDrawerOpen(false)}
          className="fixed inset-0 z-30 bg-text/30 lg:hidden"
        />
      )}

      <aside
        className={clsx(
          "z-40 flex shrink-0 flex-col border-r border-surface-variant bg-surface transition-transform",
          "max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:w-72",
          drawerOpen ? "max-lg:translate-x-0" : "max-lg:-translate-x-full",
          collapsed ? "lg:w-20" : "lg:w-72"
        )}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 px-4 pb-3 pt-4">
          {collapsed ? (
            <span role="img" aria-label={t("brand.name")} className="hidden h-9 w-9 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-brand lg:flex">
              <AudioLines size={18} strokeWidth={2.2} aria-hidden="true" />
            </span>
          ) : (
            <div className="flex min-w-0 items-center gap-2.5">
              <img src="/logo.svg" alt="" className="h-9 w-9 shrink-0 lg:hidden" />
              <span aria-hidden="true" className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-brand lg:flex">
                <AudioLines size={18} strokeWidth={2.2} />
              </span>
              <div className="min-w-0">
                <div className="truncate text-base font-extrabold leading-tight tracking-tight text-text">
                  {profile?.tenant?.businessName ?? t("brand.name")}
                </div>
                <NavLink
                  to={PLAN_PATH}
                  className="mt-0.5 block truncate text-xs font-semibold leading-tight text-text-muted outline-none hover:text-primary focus-visible:underline"
                >
                  {planLine}
                </NavLink>
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? t("layout.expandSidebar") : t("layout.collapseSidebar")}
            className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-surface-variant bg-surface text-text-muted outline-none transition-colors hover:bg-surface-muted hover:text-text focus-visible:ring-2 focus-visible:ring-primary/40 lg:flex"
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            aria-label={t("layout.closeNavigation")}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-surface-variant bg-surface text-text-muted outline-none transition-colors hover:bg-surface-muted hover:text-text focus-visible:ring-2 focus-visible:ring-primary/40 lg:hidden"
          >
            <X size={16} />
          </button>
        </div>


        <nav aria-label={t("layout.mainNavigation")} className="scrollbar-hide flex-1 overflow-y-auto border-t border-surface-variant px-3 py-2 lg:border-t-0">
          {navGroups.map(({ group, items }, groupIndex) => (
            <div key={group} className={clsx(groupIndex > 0 && "mt-2 border-t border-surface-variant pt-2 lg:mt-4 lg:border-t-0 lg:pt-0", collapsed && "lg:mt-1 lg:pt-1")}>
              {group !== "main" ? (
                <p className={clsx("px-3 pb-1 pt-1 text-[0.6875rem] font-semibold uppercase tracking-wider text-text-muted", collapsed && "lg:hidden")}>
                  {t(`nav.group.${group}`)}
                </p>
              ) : null}
              <div className="space-y-0.5">
                {items.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === "/app"}
                    title={collapsed ? t(item.labelKey) : undefined}
                    className={({ isActive }) =>
                      clsx(
                        "relative flex min-h-10 items-center gap-3 rounded-xl px-3 py-2 text-sm outline-none transition-colors",
                        "focus-visible:ring-2 focus-visible:ring-primary/40",
                        collapsed && "lg:justify-center lg:px-0",
                        isActive
                          ? "bg-primary font-semibold text-on-primary lg:bg-primary-container lg:text-primary"
                          : "font-medium text-text-muted hover:bg-surface-muted hover:text-text lg:text-text-subtle"
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {/* Desktop: a thin orange bar marks the open page. */}
                        {isActive ? <span aria-hidden="true" className="absolute -left-3 bottom-2 top-2 hidden w-1 rounded-r-full bg-primary lg:block" /> : null}
                        <item.icon size={18} strokeWidth={isActive ? 2.1 : 1.75} className="shrink-0" />
                        <span className={clsx("truncate", collapsed && "lg:hidden")}>{t(item.labelKey)}</span>
                        {item.path === "/app/chats" && chatUnread ? (
                          <span
                            className={clsx(
                              "ml-auto flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[0.6875rem] font-bold",
                              isActive ? "bg-on-primary text-primary lg:bg-primary lg:text-on-primary" : "bg-primary text-on-primary",
                              collapsed && "lg:absolute lg:right-1.5 lg:top-1 lg:h-4 lg:min-w-4 lg:px-1 lg:text-[0.625rem]"
                            )}
                            aria-label={t("chat.unreadCount", { count: chatUnread })}
                          >
                            {chatUnread > 99 ? "99+" : chatUnread}
                          </span>
                        ) : null}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="shrink-0 border-t border-surface-variant px-3 py-2">
          <UserMenu
            onLogout={handleLogout}
            menuClassName="bottom-full left-0 mb-2"
            trigger={({ open, toggle }) => (
              <button
                type="button"
                onClick={toggle}
                aria-haspopup="menu"
                aria-expanded={open}
                className={clsx(
                  "flex w-full items-center gap-3 rounded-xl p-2 text-left outline-none transition-colors hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-primary/40",
                  open && "bg-surface-muted",
                  collapsed && "lg:justify-center"
                )}
              >
                <Avatar name={user?.name ?? "?"} size={34} variant="neutral" />
                <div className={clsx("min-w-0 flex-1", collapsed && "lg:hidden")}>
                  <div className="truncate text-sm font-semibold leading-tight text-text">{user?.name ?? t("layout.account")}</div>
                  <div className="mt-0.5 truncate text-xs leading-tight text-text-muted">
                    {user?.role ? t(`team.role.${user.role}`, { defaultValue: user.email ?? "" }) : (user?.email ?? "")}
                  </div>
                </div>
              </button>
            )}
          />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Desktop header: page title + utility icons. */}
        <header className="hidden shrink-0 items-center justify-between gap-3 border-b border-border bg-surface px-8 py-4 lg:flex">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold leading-tight text-text">{title}</h1>
            {subtitle ? <p className="mt-1 text-sm text-text-muted">{subtitle}</p> : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => navigate("/app/search")}
              className="flex h-10 w-72 items-center gap-2.5 rounded-xl border border-border bg-surface px-3 text-left text-sm text-text-muted outline-none transition-colors hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <Search size={17} strokeWidth={1.75} className="shrink-0 text-icon" aria-hidden="true" />
              <span className="flex-1 truncate">{t("search.headerPlaceholder")}</span>
              <kbd className="rounded-md border border-border px-1.5 py-0.5 font-sans text-xs text-text-muted">Ctrl K</kbd>
            </button>
            <NotificationsMenu variant="desktop" />
          </div>
        </header>

        {/* Mobile header: hamburger + tenant switcher, no duplicate page title. */}
        {chatOpen ? null : (
        <MobileTopBar
          chatUnread={canChat ? chatUnread : null}
          onChatClick={canChat ? () => navigate("/app/chats") : undefined}
          onMenuClick={() => setDrawerOpen(true)}
          onSearchClick={() => navigate("/app/search")}
          businessName={profile?.tenant?.businessName ?? "—"}
          location={title}
          userInitials={initialsFor(user?.name ?? "?")}
          onLogout={handleLogout}
        />
        )}

        {/* Bottom padding clears the fixed mobile nav bar — skipped on full-page forms, which have no bottom nav to clear. */}
        <main
          className={clsx(
            chatRoute
              ? "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden lg:px-8 lg:pb-6 lg:pt-6"
              : "min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-4 pt-4 lg:px-8 lg:pb-6 lg:pt-6",
            hideMobileBars ? (chatRoute ? "pb-0" : "pb-4") : "pb-[calc(6.5rem+max(0.75rem,env(safe-area-inset-bottom)))]"
          )}
        >
          {chatRoute ? null : <PlanBanner />}
          <Outlet />
        </main>
      </div>

      {!hideMobileBars && (
        <>
          {/* Hidden while the side menu is open, so it never covers the account area at its bottom. */}
          {!drawerOpen ? (
            <MobileBottomNav onQuickAction={() => setQuickActionsOpen((open) => !open)} quickActionsOpen={quickActionsOpen} />
          ) : null}
          <QuickActionSheet
            open={quickActionsOpen}
            onClose={() => setQuickActionsOpen(false)}
            onNewPurchase={() => setPurchaseOpen(true)}
            onAddCustomer={() => setAddCustomerOpen(true)}
            onAddExpense={() => setExpenseOpen(true)}
            onNavigate={(path) => navigate(path)}
            onNewOrder={openNewOrder}
            onNewSale={openNewSale}
          />
        </>
      )}
      {canChat ? <ChatLive /> : null}
      <OnboardingModal open={showOnboarding} onClose={dismissOnboarding} />
      {showTour ? <FeatureTour userId={profile?.userId} onClose={() => setTourClosed(true)} /> : null}
      <NewOrderModal open={newOrderOpen} onClose={closeNewOrder} />
      <NewSaleModal open={newSaleOpen} onClose={closeNewSale} />
      <NewPurchaseModal open={purchaseOpen} onClose={() => setPurchaseOpen(false)} />
      <AddCustomerModal open={addCustomerOpen} onClose={() => setAddCustomerOpen(false)} />
      {/* Opened from the quick-action sheet; works whether or not Rokad bahi is switched on. */}
      <AddExpenseModal
        open={expenseOpen}
        onClose={() => setExpenseOpen(false)}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ["expenses"] });
          queryClient.invalidateQueries({ queryKey: ["daybook"] });
        }}
      />
    </div>
  );
}
