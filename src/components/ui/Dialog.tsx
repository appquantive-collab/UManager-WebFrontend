import { type ReactNode, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Buttons pinned at the bottom (always visible while the body scrolls). */
  footer?: ReactNode;
}

/**
 * A centred dialog on wider screens; on phones a bottom sheet. The body scrolls
 * inside a height cap, so long forms never push their buttons off-screen.
 */
export function Dialog({ open, onClose, title, children, footer }: DialogProps) {
  const { t } = useTranslation();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/30 sm:items-center sm:p-4">
      <button
        type="button"
        aria-label={t("ui.dialog.closeDialog")}
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative z-10 flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-2xl bg-surface shadow-elevation-3 motion-safe:animate-[sheet-up_200ms_ease-out] sm:max-h-[calc(100dvh-2rem)] sm:rounded-2xl sm:motion-safe:animate-none"
      >
        <div className="flex shrink-0 items-center justify-between px-4 pb-3 pt-4 sm:px-6 sm:pt-5">
          <h2 className="text-lg font-bold text-text">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("ui.dialog.close")}
            className="rounded-full p-1.5 text-text-muted outline-none transition-colors hover:bg-surface-muted hover:text-text focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <X size={18} />
          </button>
        </div>
        <div className={footer ? "min-h-0 flex-1 overflow-y-auto px-4 pb-4 sm:px-6" : "min-h-0 flex-1 overflow-y-auto px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6 sm:pb-6"}>
          {children}
        </div>
        {footer ? (
          <div className="shrink-0 border-t border-border px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:px-6 sm:pb-4">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
