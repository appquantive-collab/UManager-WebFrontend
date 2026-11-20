import { Menu, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import { UserMenu } from "./UserMenu";
import { NotificationsMenu } from "./NotificationsMenu";
import { BrandMark } from "./BrandMark";

interface MobileTopBarProps {
  businessName: string;
  location: string;
  onMenuClick: () => void;
  onSearchClick?: () => void;
  userInitials: string;
  onLogout: () => void;
}

const iconButton =
  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-text outline-none transition-colors hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-primary/40";

/** Phone header: menu · VoiceMunshi · search · notifications · you. */
export function MobileTopBar({ businessName, onMenuClick, onSearchClick, userInitials, onLogout }: MobileTopBarProps) {
  const { t } = useTranslation();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-1 bg-surface/95 px-2 backdrop-blur supports-[backdrop-filter]:bg-surface/85 lg:hidden">
      <button type="button" onClick={onMenuClick} aria-label={t("layoutExtra.mobileTopBar.openNavigation")} className={iconButton}>
        <Menu size={23} strokeWidth={1.9} />
      </button>

      <Link to="/app" className="flex min-w-0 flex-1 items-center rounded-lg px-1 outline-none focus-visible:ring-2 focus-visible:ring-primary/40" aria-label={businessName || "VoiceMunshi"}>
        <BrandMark />
      </Link>

      <button type="button" onClick={onSearchClick} aria-label={t("layoutExtra.mobileTopBar.search")} className={iconButton}>
        <Search size={22} strokeWidth={1.8} aria-hidden="true" />
      </button>
      <NotificationsMenu variant="mobile" />
      <UserMenu
        onLogout={onLogout}
        className="ml-1"
        menuClassName="right-0 top-full mt-2"
        trigger={({ open, toggle }) => (
          <button
            type="button"
            onClick={toggle}
            aria-haspopup="menu"
            aria-expanded={open}
            aria-label={t("layout.userMenu.open")}
            className={clsx(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-variant text-sm font-bold text-text outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-primary/40",
              open && "ring-2 ring-primary/40"
            )}
          >
            {userInitials}
          </button>
        )}
      />
    </header>
  );
}
