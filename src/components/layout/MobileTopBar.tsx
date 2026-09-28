import { Bell, ChevronDown, Menu, Search } from "lucide-react";

interface MobileTopBarProps {
  businessName: string;
  location: string;
  onMenuClick: () => void;
  onSearchClick?: () => void;
  onNotificationsClick?: () => void;
  userInitials: string;
}

export function MobileTopBar({
  businessName,
  location,
  onMenuClick,
  onSearchClick,
  onNotificationsClick,
  userInitials,
}: MobileTopBarProps) {
  return (
    <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between gap-2 border-b border-border bg-surface/95 px-3 py-2.5 backdrop-blur-md lg:hidden">
      <button
        type="button"
        onClick={onMenuClick}
        aria-label="Open navigation"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-text-muted outline-none transition-colors hover:bg-surface-muted hover:text-text focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <Menu size={18} />
      </button>

      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-primary-container bg-primary-container p-1">
          <img src="/logo-64.png" alt="" className="h-full w-full object-contain" />
        </span>
        <div className="flex min-w-0 flex-col">
          <div className="flex items-center gap-1.5">
            <button type="button" className="flex min-w-0 items-center gap-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
              <span className="truncate font-headline text-[15px] font-bold tracking-tight text-text">
                {businessName}
              </span>
              <ChevronDown size={16} className="shrink-0 text-text-muted" />
            </button>
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-success-container px-1.5 py-0.5 font-label text-[9px] font-bold text-success">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              LIVE
            </span>
          </div>
          <div className="flex items-center gap-1 truncate font-label text-[11px] text-text-muted">
            <span className="truncate">{location}</span>
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={onSearchClick}
          aria-label="Search"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-surface text-text-muted outline-none transition-colors hover:bg-surface-muted hover:text-text focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <Search size={18} />
        </button>
        <button
          type="button"
          onClick={onNotificationsClick}
          aria-label="Notifications"
          className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-surface text-text-muted outline-none transition-colors hover:bg-surface-muted hover:text-text focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <Bell size={18} />
          <span className="absolute right-1.5 top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-danger font-label text-[8px] font-bold text-white ring-2 ring-surface">
            3
          </span>
        </button>
        <span className="ml-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-container font-label text-[11px] font-bold text-primary ring-2 ring-primary-container">
          {userInitials}
        </span>
      </div>
    </header>
  );
}
