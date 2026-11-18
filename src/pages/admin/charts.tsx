import { useState, type ReactNode } from "react";
import clsx from "clsx";

/**
 * Small, single-series charts for the founder's console. One series → one
 * hue (brand primary), no legend (the card title names it). Thin bars with a
 * 2px gap and rounded tops on a quiet baseline; a tooltip on hover/focus for
 * every bar; the biggest value labelled; a hidden table for screen readers.
 */

export interface BarDatum {
  key: string;
  /** Short label under the bar (only first, middle and last are drawn). */
  label: string;
  value: number;
  /** Tooltip text, e.g. "17 Nov · ₹0.42 · 6 calls". */
  tip: string;
}

export function BarChart({ data, format, height = 140, caption }: { data: BarDatum[]; format: (v: number) => string; height?: number; caption: string }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(0, ...data.map((d) => d.value));
  const top = data.findIndex((d) => d.value === max && max > 0);
  const tickIdx = new Set([0, Math.floor((data.length - 1) / 2), data.length - 1]);

  return (
    <figure className="m-0">
      <div className="relative" style={{ height }} onMouseLeave={() => setActive(null)}>
        {/* Recessive guide at the top value */}
        {max > 0 ? (
          <div className="pointer-events-none absolute inset-x-0 top-5 border-t border-dashed border-border" aria-hidden="true">
            <span className="absolute -top-2.5 right-0 bg-surface pl-1 text-[11px] tabular-nums text-text-muted">{format(max)}</span>
          </div>
        ) : null}
        <div className="absolute inset-x-0 bottom-0 top-5 flex items-end gap-[2px] border-b border-border" aria-hidden="true">
          {data.map((d, i) => {
            const pct = max > 0 ? (d.value / max) * 100 : 0;
            return (
              <button
                key={d.key}
                type="button"
                tabIndex={-1}
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onClick={() => setActive(i)}
                className="group relative flex h-full min-w-0 flex-1 items-end outline-none"
              >
                <span
                  className={clsx("block w-full rounded-t-[4px] bg-primary transition-opacity", active !== null && active !== i ? "opacity-45" : "opacity-100")}
                  style={{ height: d.value > 0 ? `max(${pct}%, 3px)` : "0px" }}
                />
                {i === top && active === null ? (
                  <span className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 -translate-y-full whitespace-nowrap text-[11px] font-semibold tabular-nums text-text">
                    {format(d.value)}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        {active !== null ? (
          <div
            className="pointer-events-none absolute -top-1 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-text shadow-elevation-2"
            style={{ left: `${((active + 0.5) / data.length) * 100}%` }}
            role="status"
          >
            {data[active].tip}
          </div>
        ) : null}
      </div>
      <div className="mt-1.5 flex text-[11px] text-text-muted" aria-hidden="true">
        {data.map((d, i) => (
          <span key={d.key} className={clsx("min-w-0 flex-1 truncate", i === data.length - 1 ? "text-right" : i === 0 ? "text-left" : "text-center")}>
            {tickIdx.has(i) ? d.label : ""}
          </span>
        ))}
      </div>
      {/* Same numbers for screen readers */}
      <table className="sr-only">
        <caption>{caption}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.key}>
              <th scope="row">{d.label}</th>
              <td>{format(d.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/** Horizontal bars for a breakdown (by kind, model, feature): label, bar, value. */
export function BreakdownList({ rows }: { rows: { key: string; label: ReactNode; value: number; display: string; sub?: string }[] }) {
  const max = Math.max(0, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.key}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate text-text">{r.label}</span>
            <span className="shrink-0 font-semibold tabular-nums text-text">{r.display}</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-variant" aria-hidden="true">
            <div className="h-full rounded-full bg-primary" style={{ width: `${max > 0 ? Math.max(2, (r.value / max) * 100) : 0}%` }} />
          </div>
          {r.sub ? <p className="mt-0.5 text-xs text-text-muted">{r.sub}</p> : null}
        </li>
      ))}
    </ul>
  );
}

export function ChartCard({ title, subtitle, children, action }: { title: string; subtitle?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-4 shadow-elevation-1">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-text">{title}</h2>
          {subtitle ? <p className="text-xs text-text-muted">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
