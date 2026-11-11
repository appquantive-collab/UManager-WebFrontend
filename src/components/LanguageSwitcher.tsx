import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import { Check, ChevronDown, Languages } from "lucide-react";
import { supportedLanguages } from "../lib/i18n";

// Pre-login language picker: changes the UI language on this device only.
// Signed-in users change (and persist) their language from Settings instead.
export function LanguageSwitcher({ className }: { className?: string }) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const current = supportedLanguages.find((lang) => lang.code === i18n.resolvedLanguage) ?? supportedLanguages[0];

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
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t("language.label")}
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-1.5 rounded-full border border-border bg-surface/90 px-3 py-1.5 text-xs font-bold text-text shadow-elevation-1 outline-none backdrop-blur-md transition-colors hover:bg-surface focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <Languages size={14} className="text-icon" aria-hidden="true" />
        {current.label}
        <ChevronDown size={14} className={clsx("text-text-muted transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label={t("language.label")}
          className="absolute right-0 top-full z-10 mt-2 w-40 overflow-hidden rounded-xl border border-border bg-surface py-1 shadow-elevation-3"
        >
          {supportedLanguages.map((lang) => {
            const selected = lang.code === current.code;
            return (
              <li key={lang.code}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    void i18n.changeLanguage(lang.code);
                    setOpen(false);
                  }}
                  className={clsx(
                    "flex w-full items-center justify-between px-3.5 py-2 text-left text-sm outline-none transition-colors hover:bg-surface-muted focus-visible:bg-surface-muted",
                    selected ? "font-semibold text-primary" : "text-text"
                  )}
                >
                  {lang.label}
                  {selected ? <Check size={14} /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
