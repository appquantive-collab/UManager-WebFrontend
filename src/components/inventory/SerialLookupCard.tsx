import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Smartphone } from "lucide-react";
import { lookupSerial } from "../../lib/stock-api";

/** When the search looks like an IMEI/serial, say where that exact piece is. */
export function SerialLookupCard({ text }: { text: string }) {
  const { t, i18n } = useTranslation();
  const serial = text.trim().toUpperCase();
  const looksLikeSerial = /^[A-Z0-9-]{6,40}$/.test(serial) && /\d{4,}/.test(serial);
  const query = useQuery({
    queryKey: ["serial-lookup", serial],
    queryFn: () => lookupSerial(serial),
    enabled: looksLikeSerial,
    retry: false,
    staleTime: 30_000,
  });
  if (!looksLikeSerial || !query.data) return null;
  const d = query.data;
  const locale = i18n.resolvedLanguage === "hi" ? "hi-IN" : "en-IN";
  return (
    <section className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-4">
      <Smartphone size={20} className="mt-0.5 shrink-0 text-icon" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-sm font-bold text-text">
          {d.productName} · <span className="font-mono">{d.serial}</span>
        </p>
        <p className="mt-0.5 text-sm text-text-muted">
          {d.inStock
            ? t("serialLookup.inStock")
            : d.soldOn
              ? t("serialLookup.sold", {
                  number: d.soldOn.invoiceNumber,
                  customer: d.soldOn.customer ?? "",
                  date: new Date(d.soldOn.at).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" }),
                })
              : t("serialLookup.out")}
        </p>
        {d.soldOn ? (
          <Link to={`/app/sales?tab=bills&q=${encodeURIComponent(d.soldOn.invoiceNumber)}`} className="mt-1 inline-block text-sm font-semibold text-primary hover:underline">
            {t("serialLookup.openBill")}
          </Link>
        ) : null}
      </div>
    </section>
  );
}
