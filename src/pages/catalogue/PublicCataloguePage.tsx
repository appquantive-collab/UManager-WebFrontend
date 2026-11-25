import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AudioLines, MapPin, MessageCircle, Package, Phone, Printer } from "lucide-react";
import clsx from "clsx";
import { getPublicCatalogue } from "../../lib/catalogues-api";
import { formatCurrency } from "../../lib/format";
import { indianMobile, whatsappLink } from "../../lib/phone";

/**
 * The catalogue a customer opens from a shared link: the shop's name and
 * contact, then its items as cards. Order any item on WhatsApp in one tap;
 * print or save the whole thing as a PDF.
 */
export function PublicCataloguePage() {
  const { t } = useTranslation();
  const { token = "" } = useParams();
  const query = useQuery({ queryKey: ["public-catalogue", token], queryFn: () => getPublicCatalogue(token), retry: false });
  const data = query.data;

  if (query.isLoading) {
    return (
      <div className="min-h-dvh bg-surface-muted px-4 py-8">
        <div className="mx-auto max-w-5xl space-y-4">
          <div className="h-28 animate-pulse rounded-3xl bg-surface-variant" />
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="h-64 animate-pulse rounded-2xl bg-surface-variant" />
            ))}
          </div>
        </div>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-surface-muted px-6 text-center">
        <Package size={40} strokeWidth={1.5} className="text-icon" aria-hidden="true" />
        <p className="mt-3 text-lg font-bold text-text">{t("catalogue.public.notFound")}</p>
        <p className="mt-1 text-sm text-text-muted">{(query.error as Error | null)?.message}</p>
      </div>
    );
  }

  const mobile = indianMobile(data.business.phone);
  const orderLink = (item?: string) =>
    mobile ? whatsappLink(mobile, item ? t("catalogue.public.orderItemText", { item, title: data.title }) : t("catalogue.public.orderText", { title: data.title })) : null;

  return (
    <div className="min-h-dvh bg-surface-muted pb-24 print:bg-white print:pb-0">
      {/* Shop header */}
      <header className="bg-[linear-gradient(120deg,#fff7f1_0%,#ffeadb_100%)] px-4 pb-6 pt-8 print:bg-none print:pt-2">
        <div className="mx-auto max-w-5xl">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">{data.business.name}</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-text sm:text-4xl">{data.title}</h1>
          {data.note ? <p className="mt-2 max-w-2xl text-sm text-text-subtle sm:text-base">{data.note}</p> : null}
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-text-subtle">
            {data.business.phone ? (
              <a href={`tel:${data.business.phone}`} className="flex items-center gap-1.5 hover:text-text">
                <Phone size={15} className="text-icon" aria-hidden="true" />
                {data.business.phone}
              </a>
            ) : null}
            {data.business.address ? (
              <span className="flex items-center gap-1.5">
                <MapPin size={15} className="shrink-0 text-icon" aria-hidden="true" />
                {data.business.address}
              </span>
            ) : null}
          </div>
          <div className="mt-5 flex flex-wrap gap-2 print:hidden">
            {orderLink() ? (
              <a href={orderLink()!} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#1f8f4e] px-4 text-sm font-semibold text-white shadow-card outline-none hover:opacity-95 focus-visible:ring-2 focus-visible:ring-primary/40">
                <MessageCircle size={17} aria-hidden="true" />
                {t("catalogue.public.order")}
              </a>
            ) : null}
            <button type="button" onClick={() => window.print()} className="inline-flex h-11 items-center gap-2 rounded-xl border border-border bg-surface px-4 text-sm font-semibold text-text shadow-card outline-none hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-primary/40">
              <Printer size={17} className="text-icon" aria-hidden="true" />
              {t("catalogue.public.print")}
            </button>
          </div>
        </div>
      </header>

      {/* Items */}
      <main className="mx-auto max-w-5xl px-4 pt-6">
        <p className="mb-3 text-sm text-text-muted">{t("catalogue.itemsCount", { count: data.items.length })}</p>
        <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 print:grid-cols-3">
          {data.items.map((item) => {
            const details = [item.brand, item.size, item.color].filter(Boolean).join(" · ");
            const link = orderLink(item.name);
            return (
              <li key={item.id} className="flex flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-card print:break-inside-avoid print:shadow-none">
                <div className="relative aspect-square bg-surface-muted">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.name} loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-icon">
                      <Package size={40} strokeWidth={1.3} aria-hidden="true" />
                    </div>
                  )}
                  {item.inStock !== null ? (
                    <span className={clsx("absolute left-2 top-2 rounded-full px-2 py-0.5 text-[0.6875rem] font-bold", item.inStock ? "bg-success-container text-success" : "bg-danger text-white")}>
                      {item.inStock ? t("catalogue.public.inStock") : t("catalogue.public.outOfStock")}
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-1 flex-col p-3">
                  {item.category ? <p className="truncate text-[0.6875rem] font-semibold uppercase tracking-wide text-text-muted">{item.category}</p> : null}
                  <p className="line-clamp-2 text-sm font-semibold leading-snug text-text">{item.name}</p>
                  {details ? <p className="mt-0.5 truncate text-xs text-text-muted">{details}</p> : null}
                  <div className="mt-auto flex items-end justify-between gap-2 pt-2">
                    {item.price !== null ? (
                      <p className="text-base font-bold tabular-nums text-text">
                        {formatCurrency(item.price)}
                        <span className="text-xs font-medium text-text-muted"> / {item.unit}</span>
                      </p>
                    ) : (
                      <p className="text-xs font-semibold text-text-subtle">{t("catalogue.public.askPrice")}</p>
                    )}
                    {link ? (
                      <a href={link} target="_blank" rel="noreferrer" aria-label={t("catalogue.public.orderItem", { item: item.name })} title={t("catalogue.public.orderItem", { item: item.name })} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1f8f4e] text-white outline-none focus-visible:ring-2 focus-visible:ring-primary/40 print:hidden">
                        <MessageCircle size={16} aria-hidden="true" />
                      </a>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        <p className="mt-8 flex items-center justify-center gap-1.5 text-xs text-text-muted">
          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-brand-gradient text-white">
            <AudioLines size={11} strokeWidth={2.4} aria-hidden="true" />
          </span>
          {t("catalogue.public.madeWith")}
        </p>
      </main>
    </div>
  );
}
