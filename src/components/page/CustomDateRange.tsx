import { useTranslation } from "react-i18next";

/** Dates as yyyy-mm-dd (what <input type="date"> uses), in local time. */
export type CustomRange = { from: string; to: string };

const pad = (n: number) => String(n).padStart(2, "0");
export const toDateInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseDate = (value: string) => {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
};

/** Start of this month → today. */
export function defaultCustomRange(now = new Date()): CustomRange {
  return { from: toDateInput(new Date(now.getFullYear(), now.getMonth(), 1)), to: toDateInput(now) };
}

/** [start of `from`, start of the day after `to`) in ms; the two ends are swapped if picked backwards. */
export function customRangeMs({ from, to }: CustomRange): [number, number] {
  let start = parseDate(from).getTime();
  let end = parseDate(to).getTime();
  if (start > end) [start, end] = [end, start];
  const next = new Date(end);
  next.setDate(next.getDate() + 1);
  return [start, next.getTime()];
}

/** "1 Nov – 24 Nov 2026" */
export function customRangeLabel(range: CustomRange, locale: string) {
  const [start, endExclusive] = customRangeMs(range);
  const a = new Date(start);
  const b = new Date(endExclusive - 1);
  const sameYear = a.getFullYear() === b.getFullYear();
  const first = a.toLocaleDateString(locale, { day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }) });
  const last = b.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
  return first === last ? last : `${first} – ${last}`;
}

/** Two date boxes shown when the "Custom" chip is picked. */
export function CustomDateInputs({ value, onChange }: { value: CustomRange; onChange: (next: CustomRange) => void }) {
  const { t } = useTranslation();
  const today = toDateInput(new Date());
  const box =
    "h-9 rounded-lg border border-border bg-surface px-2.5 text-sm font-semibold text-text tabular-nums outline-none focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/30";
  return (
    <div role="group" aria-label={t("dateRange.custom")} className="flex flex-wrap items-center gap-2 text-sm text-text-muted">
      <label className="flex items-center gap-1.5">
        <span>{t("dateRange.from")}</span>
        <input type="date" className={box} value={value.from} max={today} onChange={(e) => e.target.value && onChange({ ...value, from: e.target.value })} />
      </label>
      <label className="flex items-center gap-1.5">
        <span>{t("dateRange.to")}</span>
        <input type="date" className={box} value={value.to} max={today} onChange={(e) => e.target.value && onChange({ ...value, to: e.target.value })} />
      </label>
    </div>
  );
}
