import { Children, useRef, useState, type ReactNode } from "react";
import { ChevronDown, Lightbulb, X, type LucideIcon } from "lucide-react";
import clsx from "clsx";

// Shared building blocks for the business pages (Sales, Purchases, Inventory,
// Customers, Suppliers, Warehouses, Reports) so they look and behave alike:
// a step-by-step guide, tappable summary numbers, filter chips, tables with
// totals, and empty states that say what to do next.

export type Tone = "primary" | "success" | "danger" | "info" | "warning" | "neutral";

const toneClasses: Record<Tone, string> = {
  primary: "bg-primary-container text-primary",
  success: "bg-success-container text-success",
  danger: "bg-danger-container text-danger",
  info: "bg-info-container text-info",
  warning: "bg-warning-container text-warning",
  neutral: "bg-surface-variant text-text-muted",
};

export function StatusPill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={clsx("inline-flex rounded-full px-2.5 py-1 text-xs font-bold", toneClasses[tone])}>{children}</span>;
}

export function SummaryTile({
  label,
  value,
  detail,
  icon: Icon,
  onClick,
}: {
  label: string;
  value: string;
  detail?: string;
  icon: LucideIcon;
  /** Kept for callers; icons are always plain grey now. */
  tone?: Tone;
  onClick?: () => void;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="line-clamp-1 text-xs font-semibold text-text-muted lg:text-sm">{label}</span>
        <Icon size={16} strokeWidth={1.75} className="shrink-0 text-icon lg:size-[18px]" aria-hidden="true" />
      </div>
      <p className="mt-1 truncate text-xl font-extrabold tabular-nums text-text lg:mt-1.5 lg:text-2xl">{value}</p>
      {detail ? <p className="mt-0.5 line-clamp-1 text-xs text-text-muted lg:line-clamp-none lg:text-sm">{detail}</p> : null}
    </>
  );
  const className = "block w-full rounded-2xl border border-border bg-surface p-3 text-left shadow-elevation-1 lg:p-4";
  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        className,
        "outline-none transition-[border-color,box-shadow] hover:border-primary/50 hover:shadow-elevation-2 focus-visible:ring-2 focus-visible:ring-primary/40"
      )}
    >
      {body}
    </button>
  ) : (
    <div className={className}>{body}</div>
  );
}

/**
 * A row of SummaryTiles. Phones: a swipeable strip showing two at a time, with
 * dots below (tap a dot to jump). Desktop: a normal grid.
 */
export function SummaryRow({ children, label }: { children: ReactNode; label?: string }) {
  const items = Children.toArray(children);
  const pages = Math.ceil(items.length / 2);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0);

  const pageWidth = (el: HTMLDivElement) => el.clientWidth + (parseFloat(getComputedStyle(el).columnGap) || 0);

  const onScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const atEnd = el.scrollLeft >= el.scrollWidth - el.clientWidth - 2;
    setPage(atEnd ? pages - 1 : Math.round(el.scrollLeft / pageWidth(el)));
  };

  const goTo = (target: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ left: target * pageWidth(el), behavior: reduceMotion ? "auto" : "smooth" });
  };

  const desktopCols = items.length >= 4 ? "lg:grid-cols-4" : items.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-2";

  return (
    <div role="group" aria-label={label}>
      <div
        ref={scrollerRef}
        onScroll={onScroll}
        className={clsx("scrollbar-hide flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain lg:grid lg:overflow-visible", desktopCols)}
      >
        {items.map((item, index) => (
          // Two per screen on phones: half the row minus half the gap.
          <div key={index} className="w-[calc((100%-var(--spacing)*3)/2)] shrink-0 snap-start lg:w-auto">
            {item}
          </div>
        ))}
      </div>
      {pages > 1 ? (
        <div className="mt-2 flex justify-center gap-1.5 lg:hidden">
          {Array.from({ length: pages }, (_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => goTo(index)}
              aria-label={`${index * 2 + 1}–${Math.min(index * 2 + 2, items.length)} / ${items.length}`}
              aria-current={page === index}
              className="flex h-6 items-center px-0.5 outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <span
                className={clsx(
                  "block h-1.5 rounded-full transition-[width,background-color] duration-200",
                  page === index ? "w-5 bg-text-muted" : "w-1.5 bg-border"
                )}
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function FilterChips<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { key: T; label: string; count?: number }[];
  value: T;
  onChange: (key: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((option) => {
        const active = option.key === value;
        return (
          <button
            key={option.key}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.key)}
            className={clsx(
              "inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/40",
              active ? "border-primary bg-primary text-on-primary" : "border-border bg-surface text-text hover:border-primary/50"
            )}
          >
            {option.label}
            {option.count !== undefined ? (
              <span className={clsx("rounded-full px-1.5 text-xs tabular-nums", active ? "bg-white/20" : "bg-surface-variant")}>
                {option.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function TableShell({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-elevation-1">
      <div className="overflow-x-auto">
        <table className="w-full min-w-max text-sm">{children}</table>
      </div>
      {footer ? (
        <div className="flex flex-wrap items-center justify-end gap-x-6 gap-y-1 border-t border-border bg-surface-muted px-5 py-3 text-sm">
          {footer}
        </div>
      ) : null}
    </div>
  );
}

export function Th({ children, align = "left" }: { children?: ReactNode; align?: "left" | "right" }) {
  return (
    <th className={clsx("px-4 py-3 text-xs font-bold uppercase tracking-wide text-text-muted", align === "right" ? "text-right" : "text-left")}>
      {children}
    </th>
  );
}

export function EmptyHelp({ icon: Icon, title, body, action }: { icon: LucideIcon; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-surface px-6 py-12 text-center">
      <Icon size={32} strokeWidth={1.5} className="text-icon" aria-hidden="true" />
      <p className="mt-3 text-base font-bold text-text">{title}</p>
      <p className="mt-1 max-w-md text-sm text-text-muted">{body}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function LoadingRows({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-busy="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-14 animate-pulse rounded-xl bg-surface-variant" />
      ))}
    </div>
  );
}

export interface GuideStep {
  icon: LucideIcon;
  /** Kept for callers; icons are always plain grey now. */
  tone?: Tone;
  title: string;
  body: string;
  action?: { label: string; onClick: () => void };
}

/**
 * Plain-language "how this works" card: numbered steps (each with its action)
 * plus a short glossary. Collapsible, remembered per device under `storageKey`.
 */
export function PageGuide({
  storageKey,
  title,
  subtitle,
  stepLabel,
  steps,
  terms,
}: {
  storageKey: string;
  title: string;
  subtitle: string;
  stepLabel: (n: number) => string;
  steps: GuideStep[];
  terms?: { term: string; meaning: string }[];
}) {
  const key = `sethsathi.guide-collapsed.${storageKey}`;
  // Collapsed by default, so pages open straight to their content; stays open
  // only for someone who opened it on this device.
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(key) !== "0";
    } catch {
      return true;
    }
  });

  // Until someone opens it once, the closed guide gently draws the eye.
  const [neverOpened, setNeverOpened] = useState(() => {
    try {
      return localStorage.getItem(key) === null;
    } catch {
      return false;
    }
  });
  const highlight = collapsed && neverOpened;

  const toggle = () => {
    setNeverOpened(false);
    setCollapsed((current) => {
      try {
        localStorage.setItem(key, current ? "0" : "1");
      } catch {
        // Not remembered without storage; the guide simply opens again next time.
      }
      return !current;
    });
  };

  return (
    <section
      className={clsx(
        "relative overflow-hidden rounded-2xl border bg-surface shadow-elevation-1 transition-colors duration-500",
        highlight ? "border-primary/30" : "border-border"
      )}
    >
      {highlight ? (
        // A soft warm shine that sweeps across every few seconds (off with "reduce motion").
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 hidden w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-primary/10 to-transparent motion-safe:block motion-safe:animate-[guide-shine_4s_ease-in-out_infinite]"
        />
      ) : null}
      <button
        type="button"
        onClick={toggle}
        aria-expanded={!collapsed}
        className="relative flex w-full items-center gap-3 px-5 py-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <Lightbulb
          size={20}
          strokeWidth={1.75}
          className={clsx("shrink-0 text-icon", highlight && "motion-safe:animate-[guide-bulb_4s_ease-in-out_infinite]")}
          aria-hidden="true"
        />
        <span className="min-w-0 flex-1">
          <span className="block text-base font-bold text-text">{title}</span>
          <span className="block text-sm text-text-muted">{subtitle}</span>
        </span>
        <ChevronDown size={20} className={clsx("shrink-0 text-text-muted transition-transform", !collapsed && "rotate-180")} aria-hidden="true" />
      </button>

      {!collapsed ? (
        <div className="border-t border-border px-5 pb-5 pt-4">
          <ol className={clsx("grid gap-3 sm:grid-cols-2", steps.length >= 4 ? "xl:grid-cols-4" : "xl:grid-cols-3")}>
            {steps.map((step, index) => (
              <li key={step.title} className="flex flex-col rounded-xl border border-border bg-background p-4">
                <div className="flex items-center gap-2.5">
                  <step.icon size={18} strokeWidth={1.75} className="text-icon" aria-hidden="true" />
                  <span className="text-xs font-bold uppercase tracking-wide text-text-muted">{stepLabel(index + 1)}</span>
                </div>
                <p className="mt-2.5 text-sm font-bold text-text">{step.title}</p>
                <p className="mt-1 flex-1 text-sm leading-relaxed text-text-muted">{step.body}</p>
                {step.action ? (
                  <button
                    type="button"
                    onClick={step.action.onClick}
                    className="mt-3 self-start rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-on-primary outline-none transition-colors hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-primary/40"
                  >
                    {step.action.label}
                  </button>
                ) : null}
              </li>
            ))}
          </ol>

          {terms && terms.length > 0 ? (
            <dl className={clsx("mt-4 grid gap-2 rounded-xl bg-surface-muted p-4 text-sm", terms.length >= 3 ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
              {terms.map((term) => (
                <div key={term.term}>
                  <dt className="font-bold text-text">{term.term}</dt>
                  <dd className="text-text-muted">{term.meaning}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

/** Page header row: a one-line explanation on the left, the page's actions on the right. */
export function PageIntro({ text, children }: { text: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="max-w-2xl text-sm text-text-muted">{text}</p>
      {children ? <div className="flex flex-wrap gap-2.5">{children}</div> : null}
    </div>
  );
}

/** Wide, scrollable popup for forms and details (the plain Dialog is small and doesn't scroll). */
export function ModalShell({
  open,
  onClose,
  title,
  subtitle,
  closeLabel,
  footer,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  closeLabel: string;
  footer?: ReactNode;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label={closeLabel} className="absolute inset-0 cursor-default" onClick={onClose} />
      <div className="relative z-10 flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl bg-surface shadow-elevation-3 sm:rounded-3xl">
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-text">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-sm text-text-muted">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-text-muted outline-none transition-colors hover:bg-surface-muted hover:text-text focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        {footer ? <div className="border-t border-border bg-surface-muted px-5 py-4 sm:px-6">{footer}</div> : null}
      </div>
    </div>
  );
}

/** Label + control stacked, with an optional hint underneath (for forms built from native inputs). */
export function Field({ label, hint, htmlFor, children }: { label: string; hint?: string; htmlFor?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-semibold text-text">
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs text-text-muted">{hint}</p> : null}
    </div>
  );
}

export const inputClass =
  "h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm text-text outline-none transition-colors placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/20";
