import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, Languages, LogOut, Settings, UserRound } from "lucide-react";
import clsx from "clsx";
import { updateProfile } from "../../lib/auth-api";
import { ApiError } from "../../lib/api";
import { showError, showSuccess } from "../../lib/toast";
import { useAuthStore, type PreferredLanguage } from "../../lib/auth-store";
import { supportedLanguages } from "../../lib/i18n";

// The account menu (Profile, Settings, Change language, Logout), shared by the
// phone top bar and the desktop sidebar. Language is saved to the user's
// profile, so it follows them to other devices — same as Settings → Language.

const itemClass =
  "flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-medium text-text outline-none transition-colors hover:bg-surface-muted focus-visible:bg-surface-muted";

export function UserMenuPanel({ onClose, onLogout, className }: { onClose: () => void; onLogout: () => void; className?: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const updateUser = useAuthStore((state) => state.updateUser);
  const currentLanguage = user?.preferredLanguage ?? "en";
  const [languagesOpen, setLanguagesOpen] = useState(false);

  const changeLanguage = useMutation({
    mutationFn: (preferredLanguage: PreferredLanguage) => updateProfile({ preferredLanguage }),
    onSuccess: (result) => {
      updateUser({ preferredLanguage: result.preferredLanguage });
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
      showSuccess(t("language.changedSuccess"));
      onClose();
    },
    onError: (err) => showError(err instanceof ApiError ? err.message : t("common.somethingWentWrong")),
  });

  const go = (path: string) => {
    onClose();
    navigate(path);
  };

  return (
    <div role="menu" className={clsx("w-64 overflow-hidden rounded-2xl border border-border bg-surface py-1 shadow-elevation-3", className)}>
      <div className="border-b border-border px-4 py-3">
        <p className="truncate text-sm font-bold text-text">{user?.name ?? t("layout.account")}</p>
        {user?.email ? <p className="truncate text-xs text-text-muted">{user.email}</p> : null}
      </div>

      <div className="py-1">
        <button type="button" role="menuitem" onClick={() => go("/app/settings?tab=business")} className={itemClass}>
          <UserRound size={17} strokeWidth={1.75} className="text-icon" aria-hidden="true" />
          {t("layout.userMenu.profile")}
        </button>
        <button type="button" role="menuitem" onClick={() => go("/app/settings")} className={itemClass}>
          <Settings size={17} strokeWidth={1.75} className="text-icon" aria-hidden="true" />
          {t("layout.userMenu.settings")}
        </button>
        <button
          type="button"
          role="menuitem"
          aria-expanded={languagesOpen}
          onClick={() => setLanguagesOpen((open) => !open)}
          className={itemClass}
        >
          <Languages size={17} strokeWidth={1.75} className="text-icon" aria-hidden="true" />
          <span className="flex-1">{t("layout.userMenu.language")}</span>
          <span className="text-xs text-text-muted">{supportedLanguages.find((l) => l.code === currentLanguage)?.label}</span>
          <ChevronDown size={15} className={clsx("text-icon transition-transform", languagesOpen && "rotate-180")} aria-hidden="true" />
        </button>
        {languagesOpen ? (
          <div className="pb-1">
            {supportedLanguages.map((lang) => (
              <button
                key={lang.code}
                type="button"
                role="menuitemradio"
                aria-checked={lang.code === currentLanguage}
                disabled={changeLanguage.isPending}
                onClick={() => (lang.code === currentLanguage ? onClose() : changeLanguage.mutate(lang.code))}
                className={clsx(itemClass, "pl-12 disabled:opacity-60", lang.code === currentLanguage && "font-semibold")}
              >
                <span className="flex-1">{lang.label}</span>
                {lang.code === currentLanguage ? <Check size={15} className="text-primary" aria-hidden="true" /> : null}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="border-t border-border py-1">
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            onClose();
            onLogout();
          }}
          className={clsx(itemClass, "text-danger hover:bg-danger-container/60 focus-visible:bg-danger-container/60")}
        >
          <LogOut size={17} strokeWidth={1.75} aria-hidden="true" />
          {t("layout.logOut")}
        </button>
      </div>
    </div>
  );
}

/** Wraps a trigger and its menu: closes on outside tap or Escape. */
export function UserMenu({
  onLogout,
  trigger,
  menuClassName,
  className,
}: {
  onLogout: () => void;
  trigger: (props: { open: boolean; toggle: () => void }) => ReactNode;
  menuClassName?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={clsx("relative", className)}>
      {trigger({ open, toggle: () => setOpen((value) => !value) })}
      {open ? <UserMenuPanel onClose={() => setOpen(false)} onLogout={onLogout} className={clsx("absolute z-50", menuClassName)} /> : null}
    </div>
  );
}
