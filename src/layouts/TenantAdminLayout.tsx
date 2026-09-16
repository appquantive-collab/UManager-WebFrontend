import { NavLink, Outlet } from "react-router-dom";
import clsx from "clsx";
import { tenantNav } from "../lib/nav";

export function TenantAdminLayout() {
  return (
    <div className="flex min-h-screen bg-[var(--color-surface-muted)]">
      <aside className="flex w-64 shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="flex h-16 items-center px-6 text-lg font-semibold text-[var(--color-text)]">
          UManager
        </div>
        <nav className="flex-1 space-y-1 px-3 py-2">
          {tenantNav.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/"}
              className={({ isActive }) =>
                clsx(
                  "flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-[var(--color-primary)] text-white"
                    : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text)]"
                )
              }
            >
              <item.icon size={18} strokeWidth={1.75} />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface)] px-6">
          <div className="text-sm text-[var(--color-text-muted)]">Tenant Admin</div>
        </header>
        <main className="flex-1 overflow-y-auto p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
