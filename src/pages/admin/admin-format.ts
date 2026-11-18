import appI18n from "../../lib/i18n";

/** The admin console is English-only: its own copy of the app's i18n, fixed to English. */
export const adminI18n = appI18n.cloneInstance({ lng: "en" });
const i18n = adminI18n;

/** Dates in the admin console: Indian English. */
const locale = () => "en-IN";

export function adminDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(locale(), { day: "numeric", month: "short", year: "numeric" });
}

/** "Today 4:05 PM", "12 Nov", or "never". */
export function lastSeen(iso: string | null | undefined): string {
  if (!iso) return i18n.t("admin.never");
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) {
    return i18n.t("admin.todayAt", { time: d.toLocaleTimeString(locale(), { hour: "numeric", minute: "2-digit" }) });
  }
  return d.toLocaleDateString(locale(), { day: "numeric", month: "short" });
}

export const tokens = (n: number) => n.toLocaleString("en-IN");

/** Rupees for AI costs: paise matter when a call costs ₹0.07. */
export function inr(n: number): string {
  if (n === 0) return "₹0";
  if (Math.abs(n) < 1) return `₹${n.toFixed(n < 0.1 ? 3 : 2)}`;
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: n < 100 ? 2 : 0 })}`;
}

/** Whole rupees for business money (sales, revenue). */
export const rupees = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

/** "Nov", "17 Nov" style short labels. */
export function shortDay(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function shortMonth(yyyyMm: string): string {
  return new Date(`${yyyyMm}-01T00:00:00`).toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
}
