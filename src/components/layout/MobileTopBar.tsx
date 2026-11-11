import { ChevronDown, Menu, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import { UserMenu } from "./UserMenu";
import { NotificationsMenu } from "./NotificationsMenu";

interface MobileTopBarProps {
  businessName: string;
  location: string;
  onMenuClick: () => void;
  onSearchClick?: () => void;
  userInitials: string;
  onLogout: () => void;
}

export function MobileTopBar({
  businessName,
  location,
  onMenuClick,
  onSearchClick,
  userInitials,
  onLogout,
}: MobileTopBarProps) {
  const { t } = useTranslation();

  return (
    <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between gap-2 border-b border-border bg-surface px-3 py-2.5 lg:hidden">
      <button
        type="button"
        onClick={onMenuClick}
        aria-label={t("layoutExtra.mobileTopBar.openNavigation")}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-text-muted outline-none transition-colors hover:bg-surface-muted hover:text-text focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <Menu size={18} />
      </button>

      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center">
          <img src="/logo-64.png" alt="" className="h-full w-full object-contain" />
        </span>
        <div className="flex min-w-0 flex-col">
          <div className="flex items-center gap-1.5">
            <button type="button" className="flex min-w-0 items-center gap-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
              <span className="truncate font-headline text-[0.9375rem] font-bold tracking-tight text-text">
                {businessName}
              </span>
              <ChevronDown size={16} className="shrink-0 text-text-muted" />
            </button>
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-success-container px-1.5 py-0.5 font-label text-[0.5625rem] font-bold text-success">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              {t("layoutExtra.mobileTopBar.live")}
            </span>
          </div>
          <div className="flex items-center gap-1 truncate font-label text-xs text-text-muted">
            <span className="truncate">{location}</span>
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={onSearchClick}
          aria-label={t("layoutExtra.mobileTopBar.search")}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-surface text-icon outline-none transition-colors hover:bg-surface-muted hover:text-text focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <Search size={18} strokeWidth={1.75} aria-hidden="true" />
        </button>
        <NotificationsMenu variant="mobile" />
        <UserMenu
          onLogout={onLogout}
          className="ml-0.5"
          menuClassName="right-0 top-full mt-2"
          trigger={({ open, toggle }) => (
            <button
              type="button"
              onClick={toggle}
              aria-haspopup="menu"
              aria-expanded={open}
              aria-label={t("layout.userMenu.open")}
              className={clsx(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border font-label text-xs font-bold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/40",
                open ? "border-primary text-text" : "border-border text-text-muted hover:border-primary/50"
              )}
            >
              {userInitials}
            </button>
          )}
        />
      </div>
    </header>
  );
}
