import { NavLink, Navigate, Outlet } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { I18nextProvider, useTranslation } from "react-i18next";
import { adminI18n } from "../pages/admin/admin-format";
import { IndianRupee, LogOut, LayoutDashboard, Loader2, Settings2, ShieldCheck, Store, TrendingUp, Users } from "lucide-react";
import clsx from "clsx";
import { getAdminMe, useAdminSession } from "../lib/admin-session";

const NAV = [
  { to: "/admin", end: true, key: "overview", icon: LayoutDashboard },
  { to: "/admin/growth", end: false, key: "growth", icon: TrendingUp },
  { to: "/admin/costs", end: false, key: "costs", icon: IndianRupee },
  { to: "/admin/businesses", end: false, key: "businesses", icon: Store },
  { to: "/admin/users", end: false, key: "users", icon: Users },
  { to: "/admin/settings", end: false, key: "settings", icon: Settings2 },
] as const;

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
  const queryClient = useQueryClient();
  const token = useAdminSession((s) => s.accessToken);
  const admin = useAdminSession((s) => s.admin);
  const clear = useAdminSession((s) => s.clear);
  // Confirms the saved admin token is still good (an expired/stopped one is cleared → sign-in page).
  const me = useQuery({ queryKey: ["admin-me", token], queryFn: getAdminMe, enabled: Boolean(token), retry: false });

  const logOut = () => {
    clear();
    queryClient.removeQueries({ predicate: (q) => String(q.queryKey[0]).startsWith("admin") });
  };

  if (!token) return <Navigate to="/admin/login" replace />;
  if (me.isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <Loader2 size={24} className="animate-spin text-icon" aria-label={t("common.loading")} />
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh bg-background">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-border bg-surface lg:flex">
        <div className="flex items-center gap-2.5 border-b border-border px-4 py-4">
          <ShieldCheck size={20} className="text-primary" aria-hidden="true" />
          <div className="min-w-0">
            <p className="truncate text-sm font-extrabold text-text">{t("admin.brand")}</p>
            <p className="truncate text-xs text-text-muted">{t("admin.brandSub")}</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-3" aria-label={t("admin.brand")}>
          {NAV.map((item) => (
            <NavLink
              key={item.key}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                clsx(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/40",
                  isActive ? "bg-primary text-on-primary" : "text-text hover:bg-surface-muted"
                )
              }
            >
              <item.icon size={18} strokeWidth={1.75} aria-hidden="true" />
              {t(`admin.nav.${item.key}`)}
            </NavLink>
          ))}
        </nav>
        <div className="m-3 rounded-xl border border-border p-3">
          <p className="truncate text-sm font-semibold text-text">{me.data?.name ?? admin?.name}</p>
          <p className="truncate text-xs text-text-muted">{me.data?.email ?? admin?.email}</p>
          <button
            type="button"
            onClick={logOut}
            className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <LogOut size={15} aria-hidden="true" />
            Log out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Phone top bar + tabs */}
        <header className="sticky top-0 z-30 border-b border-border bg-surface lg:hidden">
          <div className="flex items-center gap-2 px-4 py-3">
            <ShieldCheck size={18} className="text-primary" aria-hidden="true" />
            <p className="flex-1 text-base font-extrabold text-text">{t("admin.brand")}</p>
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
                    isActive ? "border-primary bg-primary text-on-primary" : "border-border text-text"
                  )
                }
              >
                <item.icon size={15} aria-hidden="true" />
                {t(`admin.nav.${item.key}`)}
              </NavLink>
            ))}
          </nav>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
