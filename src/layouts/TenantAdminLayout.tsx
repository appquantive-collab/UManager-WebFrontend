import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { Bell, ChevronLeft, ChevronRight, LogOut, Moon, X } from "lucide-react";
import { tenantNav } from "../lib/nav";
import { useAuthStore } from "../lib/auth-store";
import { getPageMeta } from "../lib/pageMeta";
import { getProfile } from "../lib/auth-api";
import { Avatar } from "../components/ui/Avatar";
import { SearchInput } from "../components/ui/SearchInput";
import { MobileBottomNav } from "../components/layout/MobileBottomNav";
import { MobileTopBar } from "../components/layout/MobileTopBar";
import { QuickActionSheet } from "../components/layout/QuickActionSheet";
import { OnboardingModal } from "../components/onboarding/OnboardingModal";
import { NewOrderModal } from "../components/orders/NewOrderModal";
import { NewSaleModal } from "../components/orders/NewSaleModal";
import { useNewOrderModalStore } from "../lib/new-order-store";
import { useNewSaleModalStore } from "../lib/new-sale-store";

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
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const clearSession = useAuthStore((state) => state.clearSession);
  const updateUser = useAuthStore((state) => state.updateUser);
  const [collapsed, setCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const newOrderOpen = useNewOrderModalStore((state) => state.open);
  const openNewOrder = useNewOrderModalStore((state) => state.openModal);
  const closeNewOrder = useNewOrderModalStore((state) => state.closeModal);
  const newSaleOpen = useNewSaleModalStore((state) => state.open);
  const openNewSale = useNewSaleModalStore((state) => state.openModal);
  const closeNewSale = useNewSaleModalStore((state) => state.closeModal);
  const [onboardingDismissed, setOnboardingDismissed] = useState(
    () => sessionStorage.getItem(ONBOARDING_SKIPPED_KEY) === "1"
  );

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: getProfile,
  });

  useEffect(() => {
    if (!profile) return;
    updateUser({ name: profile.name, email: profile.email, tenantId: profile.tenant?.tenantId ?? null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  const showOnboarding = Boolean(profile) && !profile?.tenant?.onboarding.completed && !onboardingDismissed;

  const dismissOnboarding = () => {
    sessionStorage.setItem(ONBOARDING_SKIPPED_KEY, "1");
    setOnboardingDismissed(true);
  };

  // Navigating on a phone should dismiss the drawer, not leave it covering the page.
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    clearSession();
    navigate("/login", { replace: true });
  };

  const { title, subtitle } = getPageMeta(location.pathname);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {drawerOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setDrawerOpen(false)}
          className="fixed inset-0 z-30 bg-text/30 lg:hidden"
        />
      )}

      <aside
        className={clsx(
          "z-40 flex shrink-0 flex-col border-r border-surface-variant bg-surface transition-transform",
          "max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:w-72",
          drawerOpen ? "max-lg:translate-x-0" : "max-lg:-translate-x-full",
          collapsed ? "lg:w-20" : "lg:w-67"
        )}
      >
        <div className="flex shrink-0 items-start justify-between gap-2 px-5 pb-4 pt-5">
          {collapsed ? (
            <img src="/logo-64.png" alt="UManager" className="hidden h-9 w-9 object-contain lg:block" />
          ) : (
            <div className="flex min-w-0 items-center gap-2.5">
              <img src="/logo-64.png" alt="" className="h-9 w-9 shrink-0 object-contain" />
              <div className="min-w-0">
                <div className="truncate text-xl font-extrabold leading-tight tracking-tight text-text">
                  UManager
                </div>
                <div className="mt-1 text-sm leading-tight text-text-muted">Tenant Admin</div>
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-surface-variant bg-surface text-text-muted outline-none transition-colors hover:bg-surface-muted hover:text-text focus-visible:ring-2 focus-visible:ring-primary/40 lg:flex"
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            aria-label="Close navigation"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-surface-variant bg-surface text-text-muted outline-none transition-colors hover:bg-surface-muted hover:text-text focus-visible:ring-2 focus-visible:ring-primary/40 lg:hidden"
          >
            <X size={16} />
          </button>
        </div>

        {!collapsed && (
          <div className="px-5 pb-5">
            <SearchInput placeholder="Search..." />
          </div>
        )}

        <nav className="scrollbar-hide flex-1 space-y-1 overflow-y-auto border-t border-surface-variant px-5 py-4">
          {tenantNav.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/app"}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) =>
                clsx(
                  "flex items-center gap-3.5 rounded-xl px-5 py-2.5 text-[15px] outline-none transition-colors",
                  "focus-visible:ring-2 focus-visible:ring-primary/40",
                  collapsed && "lg:justify-center lg:px-0",
                  isActive
                    ? "bg-primary font-semibold text-on-primary"
                    : "font-medium text-text-muted hover:bg-surface-muted hover:text-text"
                )
              }
            >
              <item.icon size={20} strokeWidth={1.6} />
              <span className={clsx(collapsed && "lg:hidden")}>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="relative shrink-0 border-t border-surface-variant px-4 py-3">
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className={clsx(
              "flex w-full items-center gap-3 rounded-xl p-2 text-left outline-none transition-colors hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-primary/40",
              collapsed && "lg:justify-center"
            )}
          >
            <Avatar name={user?.name ?? "?"} size={40} variant="neutral" />
            <div className={clsx("min-w-0 flex-1", collapsed && "lg:hidden")}>
              <div className="truncate text-[15px] font-semibold leading-tight text-text">
                {user?.name ?? "Account"}
              </div>
              <div className="mt-0.5 truncate text-sm leading-tight text-text-muted">{user?.email ?? ""}</div>
            </div>
          </button>

          {menuOpen ? (
            <div className="absolute bottom-full left-3 z-10 mb-2 w-48 overflow-hidden rounded-xl bg-surface py-1 shadow-elevation-3">
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-text-muted outline-none transition-colors hover:bg-surface-muted hover:text-text focus-visible:bg-surface-muted"
              >
                <LogOut size={16} strokeWidth={1.75} />
                Log out
              </button>
            </div>
          ) : null}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Desktop header: page title + utility icons. */}
        <header className="hidden shrink-0 items-center justify-between gap-3 border-b border-surface-variant bg-surface px-8 py-5 lg:flex">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold leading-tight text-text">{title}</h1>
            {subtitle ? <p className="mt-1 text-sm text-text-muted">{subtitle}</p> : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              aria-label="Toggle theme"
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-variant text-text-muted outline-none transition-colors hover:text-text focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <Moon size={18} />
            </button>
            <button
              type="button"
              aria-label="Notifications"
              className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-surface-variant text-text-muted outline-none transition-colors hover:text-text focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <Bell size={18} />
              <span className="absolute right-2.5 top-2.5 h-1.5 w-1.5 rounded-full bg-danger" />
            </button>
          </div>
        </header>

        {/* Mobile header: hamburger + tenant switcher, no duplicate page title. */}
        <MobileTopBar
          onMenuClick={() => setDrawerOpen(true)}
          businessName={profile?.tenant?.businessName ?? "—"}
          location={title}
          userInitials={initialsFor(user?.name ?? "?")}
        />

        {/* Bottom padding clears the fixed mobile nav bar — skipped on full-page forms, which have no bottom nav to clear. */}
        <main className={clsx("flex-1 overflow-y-auto px-4 pt-4 lg:px-8 lg:pb-6 lg:pt-6", isFullPageForm(location.pathname) ? "pb-4" : "pb-24")}>
          <Outlet />
        </main>
      </div>

      {!isFullPageForm(location.pathname) && (
        <>
          <MobileBottomNav onQuickAction={() => setQuickActionsOpen(true)} />
          <QuickActionSheet
            open={quickActionsOpen}
            onClose={() => setQuickActionsOpen(false)}
            onNewOrder={openNewOrder}
            onNewSale={openNewSale}
          />
        </>
      )}
      <OnboardingModal open={showOnboarding} onClose={dismissOnboarding} />
      <NewOrderModal open={newOrderOpen} onClose={closeNewOrder} />
      <NewSaleModal open={newSaleOpen} onClose={closeNewSale} />
    </div>
  );
}
