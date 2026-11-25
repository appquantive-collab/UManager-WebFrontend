import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, Download, FileSpreadsheet, FileText, Sheet } from "lucide-react";
import clsx from "clsx";
import type { ExportFormat } from "../../lib/table-export";

const FORMATS: { key: ExportFormat; icon: typeof Download }[] = [
  { key: "excel", icon: FileSpreadsheet },
  { key: "pdf", icon: FileText },
  { key: "csv", icon: Sheet },
];

/** "Download ▾" → Excel / PDF / CSV. */
export function ExportMenu({ label, onExport, badge, align = "right" }: { label: string; onExport: (format: ExportFormat) => void; badge?: ReactNode; align?: "left" | "right" }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-primary outline-none hover:bg-primary-container focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <Download size={15} aria-hidden="true" />
        {label}
        {badge}
        <ChevronDown size={14} className={clsx("transition-transform", open && "rotate-180")} aria-hidden="true" />
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          className={clsx(
            "absolute top-full z-30 mt-1 w-52 overflow-hidden rounded-xl border border-border bg-surface py-1 shadow-elevation-3",
            align === "right" ? "right-0" : "left-0"
          )}
        >
          {FORMATS.map(({ key, icon: Icon }) => (
            <button
              key={key}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onExport(key);
              }}
              className="flex w-full items-start gap-3 px-3.5 py-2.5 text-left text-sm text-text outline-none hover:bg-surface-muted focus-visible:bg-surface-muted"
            >
              <Icon size={17} className={clsx("mt-0.5 shrink-0", key === "excel" ? "text-success" : key === "pdf" ? "text-danger" : "text-icon")} aria-hidden="true" />
              <span className="flex-1">
                <span className="block font-semibold">{t(`export.${key}.label`)}</span>
                <span className="block text-xs text-text-muted">{t(`export.${key}.hint`)}</span>
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
