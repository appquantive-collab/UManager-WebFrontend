import { useEffect, useState } from "react";
import { NavLink, Navigate, Outlet, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { I18nextProvider, useTranslation } from "react-i18next";
import { adminI18n } from "../pages/admin/admin-format";
import { AudioLines, IndianRupee, LayoutDashboard, Loader2, LogOut, Search, Settings2, Store, TrendingUp, Users } from "lucide-react";
import clsx from "clsx";
import { getAdminMe, useAdminSession } from "../lib/admin-session";

const NAV_MAIN = [
  { to: "/admin", end: true, key: "overview", icon: LayoutDashboard },
  { to: "/admin/growth", end: false, key: "growth", icon: TrendingUp },
  { to: "/admin/costs", end: false, key: "costs", icon: IndianRupee },
  { to: "/admin/businesses", end: false, key: "businesses", icon: Store },
  { to: "/admin/users", end: false, key: "users", icon: Users },
] as const;
const NAV_OTHER = [{ to: "/admin/settings", end: false, key: "settings", icon: Settings2 }] as const;
const NAV = [...NAV_MAIN, ...NAV_OTHER];

const initials = (name?: string | null) =>
  (name ?? "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "A";

/**
 * The founder's console: its own frame, separate from any one shop. Only
 * VoiceMunshi team logins (PLATFORM_ADMIN_EMAILS) get in; everyone else goes
 * back to their business.
 */
export function AdminLayout() {
  // The founder's console is English-only, whatever language the app is set to.
  return (
    <I18nextProvider i18n={adminI18n}>
      <AdminFrame />
    </I18nextProvider>
  );
}

function AdminFrame() {
  const { t } = useTranslation();
  // Bigger type on big screens (see .admin-root in index.css); undone when leaving the console.
  useEffect(() => {
    document.documentElement.classList.add("admin-root");
    return () => document.documentElement.classList.remove("admin-root");
  }, []);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const token = useAdminSession((s) => s.accessToken);
  const admin = useAdminSession((s) => s.admin);
  const clear = useAdminSession((s) => s.clear);
  const [search, setSearch] = useState("");
  // Confirms the saved admin token is still good (an expired/stopped one is cleared → sign-in page).
  const me = useQuery({ queryKey: ["admin-me", token], queryFn: getAdminMe, enabled: Boolean(token), retry: false });
  const name = me.data?.name ?? admin?.name ?? "";
  const email = me.data?.email ?? admin?.email ?? "";

  const logOut = () => {
    clear();
    queryClient.removeQueries({ predicate: (q) => String(q.queryKey[0]).startsWith("admin") });
  };

  if (!token) return <Navigate to="/admin/login" replace />;
  if (me.isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-surface-muted">
        <Loader2 size={24} className="animate-spin text-icon" aria-label={t("common.loading")} />
      </div>
    );
  }

  const navItem = (item: (typeof NAV)[number]) => (
    <NavLink
      key={item.key}
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        clsx(
          "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/40",
          isActive ? "bg-primary-container font-semibold text-primary" : "font-medium text-text-subtle hover:bg-surface-muted hover:text-text"
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive ? <span aria-hidden="true" className="absolute -left-3 top-2 bottom-2 w-1 rounded-r-full bg-primary" /> : null}
          <item.icon size={18} strokeWidth={isActive ? 2.1 : 1.8} aria-hidden="true" />
          {t(`admin.nav.${item.key}`)}
        </>
      )}
    </NavLink>
  );

  return (
    <div className="flex min-h-dvh bg-surface-muted">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-border bg-surface lg:flex">
        <div className="flex h-16 items-center gap-2.5 px-5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-brand" aria-hidden="true">
            <AudioLines size={17} strokeWidth={2.2} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[0.9375rem] font-extrabold tracking-tight">
              <span className="text-text">Voice</span>
              <span className="text-primary">Munshi</span>
            </p>
            <p className="truncate text-[0.6875rem] font-medium text-text-muted">{t("admin.brandSub")}</p>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 pb-3" aria-label={t("admin.brand")}>
          <p className="px-3 pb-1.5 pt-3 text-[0.6875rem] font-semibold uppercase tracking-wider text-text-muted">Main</p>
          <div className="space-y-0.5">{NAV_MAIN.map(navItem)}</div>
          <p className="px-3 pb-1.5 pt-5 text-[0.6875rem] font-semibold uppercase tracking-wider text-text-muted">Others</p>
          <div className="space-y-0.5">{NAV_OTHER.map(navItem)}</div>
        </nav>
        <div className="m-3 flex items-center gap-3 rounded-2xl border border-border bg-surface-muted p-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-gradient text-xs font-bold text-white">{initials(name)}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-text">{name}</p>
            <p className="truncate text-xs text-text-muted">{email}</p>
          </div>
          <button
            type="button"
            onClick={logOut}
            aria-label="Log out"
            title="Log out"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-icon outline-none hover:bg-surface hover:text-danger focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <LogOut size={16} aria-hidden="true" />
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Desktop top bar: search businesses · who's signed in */}
        <header className="sticky top-0 z-30 hidden h-16 items-center justify-between gap-4 border-b border-border bg-surface/95 px-8 backdrop-blur lg:flex">
          <form
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              navigate(`/admin/businesses?q=${encodeURIComponent(search.trim())}`);
            }}
            className="flex h-10 w-full max-w-sm items-center gap-2 rounded-xl border border-border bg-surface-muted px-3 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/15"
          >
            <Search size={16} className="shrink-0 text-icon" aria-hidden="true" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search businesses, owners, mobiles…"
              aria-label="Search businesses"
              className="h-full w-full bg-transparent text-sm text-text outline-none placeholder:text-text-placeholder"
            />
          </form>
          <div className="flex shrink-0 items-center gap-2.5 rounded-full border border-border bg-surface py-1 pl-1 pr-3.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-gradient text-xs font-bold text-white">{initials(name)}</span>
            <span className="text-sm font-medium text-text">Welcome, {name.split(" ")[0] || "Admin"}!</span>
          </div>
        </header>

        {/* Phone top bar + tabs */}
        <header className="sticky top-0 z-30 border-b border-border bg-surface lg:hidden">
          <div className="flex items-center gap-2.5 px-4 py-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-gradient text-white" aria-hidden="true">
              <AudioLines size={16} strokeWidth={2.2} />
            </span>
            <p className="flex-1 text-base font-extrabold tracking-tight">
              <span className="text-text">Voice</span>
              <span className="text-primary">Munshi</span> <span className="text-sm font-semibold text-text-muted">Admin</span>
            </p>
            <button
              type="button"
              onClick={logOut}
              aria-label="Log out"
              className="flex h-10 w-10 items-center justify-center rounded-full text-icon outline-none hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <LogOut size={18} aria-hidden="true" />
            </button>
          </div>
          <nav className="scrollbar-hide flex gap-2 overflow-x-auto px-4 pb-3" aria-label={t("admin.brand")}>
            {NAV.map((item) => (
              <NavLink
                key={item.key}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  clsx(
                    "flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                    isActive ? "border-primary/30 bg-primary-container text-primary" : "border-border bg-surface text-text-subtle"
                  )
                }
              >
                <item.icon size={15} aria-hidden="true" />
                {t(`admin.nav.${item.key}`)}
              </NavLink>
            ))}
          </nav>
        </header>

        <main className="w-full min-w-0 flex-1 px-4 py-5 lg:px-8 lg:py-7 2xl:px-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
