import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { CalendarClock } from "lucide-react";
import clsx from "clsx";
import { getExpiring } from "../../lib/stock-api";
import { formatCurrency, formatQty } from "../../lib/format";

/** Batches expiring in the next 60 days (or already expired) — sell or return these first. */
export function ExpiringPanel() {
  const { t, i18n } = useTranslation();
  const { data } = useQuery({ queryKey: ["stock-expiring"], queryFn: () => getExpiring(60), staleTime: 60_000 });
  if (!data || data.length === 0) return null;
  const locale = i18n.resolvedLanguage === "hi" ? "hi-IN" : "en-IN";
  const value = data.reduce((s, b) => s + b.value, 0);
  const daysLeft = (iso: string) => Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);

  return (
    <section className="rounded-2xl border border-border bg-surface p-4 sm:p-5" aria-label={t("expiring.title")}>
      <div className="flex items-start gap-3">
        <CalendarClock size={20} className="mt-0.5 shrink-0 text-icon" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold text-text">{t("expiring.title")}</h2>
          <p className="text-sm text-text-muted">{t("expiring.subtitle", { count: data.length, value: formatCurrency(value) })}</p>
        </div>
      </div>
      <ul className="mt-3 divide-y divide-border">
        {data.slice(0, 8).map((b) => {
          const left = daysLeft(b.expiryDate);
          return (
            <li key={`${b.productId}-${b.batchNo}`} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-text">{b.productName}</p>
                <p className="text-xs text-text-muted">
                  {t("expiring.batch", { batch: b.batchNo })} · {formatQty(b.quantity)} {b.unit} ·{" "}
                  {new Date(b.expiryDate).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" })}
                </p>
              </div>
              <span className={clsx("shrink-0 text-xs font-bold", b.expired || left <= 15 ? "text-danger" : "text-warning")}>
                {b.expired ? t("expiring.expired") : t("expiring.daysLeft", { count: left })}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
