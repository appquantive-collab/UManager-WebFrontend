import i18n from "../../lib/i18n";

const locale = () => (i18n.resolvedLanguage === "hi" ? "hi-IN" : "en-IN");
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const DAY = 86_400_000;

export const timeOf = (iso: string) => new Date(iso).toLocaleTimeString(locale(), { hour: "numeric", minute: "2-digit" });

/** Today / Yesterday / weekday / date — the separators between days in a chat. */
export function dayLabel(iso: string): string {
  const d = new Date(iso);
  const diff = Math.round((startOfDay(new Date()) - startOfDay(d)) / DAY);
  if (diff === 0) return i18n.t("chat.today");
  if (diff === 1) return i18n.t("chat.yesterday");
  if (diff < 7) return d.toLocaleDateString(locale(), { weekday: "long" });
  return d.toLocaleDateString(locale(), { day: "numeric", month: "short", year: d.getFullYear() === new Date().getFullYear() ? undefined : "numeric" });
}

/** Chat list: time today, "Yesterday", else a short date. */
export function listTime(iso: string): string {
  const d = new Date(iso);
  const diff = Math.round((startOfDay(new Date()) - startOfDay(d)) / DAY);
  if (diff === 0) return timeOf(iso);
  if (diff === 1) return i18n.t("chat.yesterday");
  if (diff < 7) return d.toLocaleDateString(locale(), { weekday: "short" });
  return d.toLocaleDateString(locale(), { day: "numeric", month: "short" });
}

export function lastSeenLabel(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const diff = Math.round((startOfDay(new Date()) - startOfDay(d)) / DAY);
  if (diff === 0) return i18n.t("chat.lastSeenToday", { time: timeOf(iso) });
  if (diff === 1) return i18n.t("chat.lastSeenYesterday", { time: timeOf(iso) });
  return i18n.t("chat.lastSeenOn", { date: d.toLocaleDateString(locale(), { day: "numeric", month: "short" }) });
}

export const sameDay = (a: string, b: string) => startOfDay(new Date(a)) === startOfDay(new Date(b));

export function fileSize(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;

/** Cloudinary turns any audio into mp3 when asked by extension — plays on every phone, iPhones included. */
export function playableAudio(url: string): string {
  if (!url.includes("res.cloudinary.com") || !url.includes("/video/upload/")) return url;
  return url.replace(/\.(webm|weba|ogg|oga|m4a|mp4|aac|wav)(\?.*)?$/i, ".mp3");
}

/** Cloudinary: a smaller copy for the chat bubble (full size opens on tap). */
export function thumbOf(url: string): string {
  if (!url.includes("res.cloudinary.com") || !url.includes("/image/upload/")) return url;
  return url.replace("/image/upload/", "/image/upload/c_limit,w_640,q_auto,f_auto/");
}

export const initials = (name: string) => {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
};
