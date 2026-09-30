import { NavLink } from "react-router-dom";
import clsx from "clsx";
import { Plus } from "lucide-react";
import { mobileBottomNav } from "../../lib/nav";

interface MobileBottomNavProps {
  onQuickAction: () => void;
}

export function MobileBottomNav({ onQuickAction }: MobileBottomNavProps) {
  const [home, sales, stock, staff] = mobileBottomNav;
  const left = [home, sales];
  const right = [stock, staff];

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    clsx(
      "flex h-full min-w-[56px] flex-1 flex-col items-center justify-center gap-0.5 outline-none transition-colors",
      "focus-visible:ring-2 focus-visible:ring-primary/40",
      isActive ? "text-primary" : "text-text-muted hover:text-text"
    );

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden">
      <div className="relative mx-auto flex h-16 max-w-lg items-center justify-between px-2">
        {left.map((item) => (
          <NavLink key={item.path} to={item.path} end={item.path === "/app"} className={linkClass}>
            <item.icon size={22} strokeWidth={1.9} />
            <span className="font-label text-[10px] font-semibold tracking-tight">{item.label}</span>
          </NavLink>
        ))}

        <div className="relative flex h-full flex-1 items-center justify-center">
          <button
            type="button"
            onClick={onQuickAction}
            aria-label="Quick actions"
            className="absolute -top-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-on-primary shadow-lg shadow-primary/30 outline-none transition-transform hover:bg-primary-hover active:scale-95 focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <Plus size={26} strokeWidth={2.5} />
          </button>
          <span className="mt-7 font-label text-[10px] font-medium tracking-tight text-text-muted">Create</span>
        </div>

        {right.map((item) => (
          <NavLink key={item.path} to={item.path} className={linkClass}>
            <item.icon size={22} strokeWidth={1.9} />
            <span className="font-label text-[10px] font-semibold tracking-tight">{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
