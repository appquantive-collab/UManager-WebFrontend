import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import clsx from "clsx";

/** Founder console building blocks: one look for every admin page. */

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-[1.625rem] font-bold tracking-tight text-text">{title}</h1>
        {subtitle ? <p className="mt-0.5 text-sm text-text-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/** White card with a soft lift; optional header row (icon, title, right side). */
export function AdminCard({
  title,
  icon: Icon,
  right,
  children,
  className,
  bodyClassName,
}: {
  title?: string;
  icon?: LucideIcon;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={clsx("min-w-0 rounded-2xl border border-border bg-surface shadow-card", className)}>
      {title ? (
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 pb-1 pt-4">
          <h2 className="flex min-w-0 items-center gap-2 text-[0.9375rem] font-semibold text-text">
            {Icon ? (
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary-container text-primary">
                <Icon size={15} strokeWidth={2} aria-hidden="true" />
              </span>
            ) : null}
            <span className="truncate">{title}</span>
          </h2>
          {right}
        </div>
      ) : null}
      <div className={clsx(title ? "px-5 pb-5 pt-3" : "p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

/** Stat card: small tinted icon + label, big number, a line of context (and an optional trend). */
export function StatCard({
  icon: Icon,
  label,
  value,
  detail,
  trend,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail?: string;
  trend?: { text: string; up: boolean } | null;
  onClick?: () => void;
}) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-primary/15 bg-primary-container text-primary">
            <Icon size={15} strokeWidth={2} aria-hidden="true" />
          </span>
          <span className="truncate text-[0.8125rem] font-medium text-text-subtle">{label}</span>
        </span>
        {trend ? (
          <span className={clsx("hidden shrink-0 text-xs font-semibold tabular-nums sm:inline", trend.up ? "text-success" : "text-danger")}>{trend.text}</span>
        ) : null}
      </div>
      <p className="mt-4 truncate text-[1.625rem] font-bold leading-none tracking-tight tabular-nums text-text">{value}</p>
      {detail ? <p className="mt-2 truncate text-xs text-text-muted">{detail}</p> : <p className="mt-2 text-xs">&nbsp;</p>}
    </>
  );
  const shell = "min-w-0 rounded-2xl border border-border bg-surface p-4 text-left shadow-card";
  return onClick ? (
    <button type="button" onClick={onClick} className={clsx(shell, "outline-none transition-colors hover:border-primary/30 focus-visible:ring-2 focus-visible:ring-primary/40")}>
      {body}
    </button>
  ) : (
    <div className={shell}>{body}</div>
  );
}

/** "Showing 1 to 20 of 84 entries" + page buttons. */
export function Pagination({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  // A short window of page numbers around the current one.
  const start = Math.max(1, Math.min(page - 2, pages - 4));
  const numbers = Array.from({ length: Math.min(5, pages) }, (_, i) => start + i);
  const btn = "flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-primary/40";
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3">
      <p className="text-sm text-text-muted">
        Showing {from} to {to} of {total} entries
      </p>
      <div className="flex items-center gap-1">
        <button type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => onPage(page - 1)} className={clsx(btn, "border border-border text-icon disabled:opacity-40")}>
          <ChevronLeft size={16} aria-hidden="true" />
        </button>
        {numbers.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onPage(n)}
            aria-current={n === page ? "page" : undefined}
            className={clsx(btn, n === page ? "bg-primary text-on-primary" : "text-text hover:bg-surface-muted")}
          >
            {n}
          </button>
        ))}
        <button type="button" aria-label="Next page" disabled={page >= pages} onClick={() => onPage(page + 1)} className={clsx(btn, "border border-border text-icon disabled:opacity-40")}>
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

/** Table cell styles shared by admin tables. */
export const th = "whitespace-nowrap px-4 py-3 text-left text-xs font-semibold text-text-subtle";
export const td = "whitespace-nowrap px-4 py-3.5 text-sm text-text";
