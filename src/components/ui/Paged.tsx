import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import clsx from "clsx";
import { useMediaQuery } from "../../lib/useMediaQuery";

/**
 * Long lists, one way everywhere: on desktop a page of rows with page numbers
 * under it; on phones the next rows load by themselves as you reach the end
 * (infinite scroll). Search/filter changes (`resetKey`) go back to the top.
 *
 *   const { visible, footer } = usePaged(rows, { resetKey: search + filter });
 *   … visible.map(…) … {footer}
 */
export function usePaged<T>(items: T[], options: { pageSize?: number; resetKey?: unknown; mode?: "auto" | "pages" | "scroll" } = {}) {
  const pageSize = options.pageSize ?? 20;
  const isDesktop = useMediaQuery("(min-width: 64rem)");
  const mode = options.mode && options.mode !== "auto" ? options.mode : isDesktop ? "pages" : "scroll";
  const [page, setPage] = useState(1);
  const [shown, setShown] = useState(pageSize);

  // New search / filter: start again from the top.
  useEffect(() => {
    setPage(1);
    setShown(pageSize);
  }, [options.resetKey, pageSize]);

  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pages);
  const visible = mode === "pages" ? items.slice((safePage - 1) * pageSize, safePage * pageSize) : items.slice(0, shown);
  const hasMore = mode === "scroll" && shown < total;

  const footer =
    mode === "pages" ? (
      <PageNumbers page={safePage} pageSize={pageSize} total={total} onPage={setPage} />
    ) : hasMore ? (
      <LoadMoreSentinel key={shown} onLoad={() => setShown((n) => Math.min(total, n + pageSize))} />
    ) : null;

  return { visible, footer, total, page: safePage, setPage };
}

/** "Showing 1 to 20 of 84" + page buttons (hidden when everything fits on one page). */
export function PageNumbers({ page, pageSize, total, onPage, className }: { page: number; pageSize: number; total: number; onPage: (page: number) => void; className?: string }) {
  const { t } = useTranslation();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const start = Math.max(1, Math.min(page - 2, pages - 4));
  const numbers = Array.from({ length: Math.min(5, pages) }, (_, i) => start + i);
  const go = (n: number) => {
    onPage(n);
    // Back to the top of the list's scroll area.
    document.querySelector("main")?.scrollTo({ top: 0, behavior: "smooth" });
  };
  const btn = "flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-primary/40";
  return (
    <nav aria-label={t("pager.label")} className={clsx("flex flex-wrap items-center justify-between gap-3 px-1 py-3", className)}>
      <p className="text-sm text-text-muted">{t("pager.showing", { from, to, total })}</p>
      <div className="flex items-center gap-1">
        <button type="button" aria-label={t("pager.previous")} disabled={page <= 1} onClick={() => go(page - 1)} className={clsx(btn, "border border-border bg-surface text-icon disabled:opacity-40")}>
          <ChevronLeft size={16} aria-hidden="true" />
        </button>
        {numbers.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => go(n)}
            aria-current={n === page ? "page" : undefined}
            className={clsx(btn, n === page ? "bg-primary text-on-primary" : "text-text hover:bg-surface-muted")}
          >
            {n}
          </button>
        ))}
        <button type="button" aria-label={t("pager.next")} disabled={page >= pages} onClick={() => go(page + 1)} className={clsx(btn, "border border-border bg-surface text-icon disabled:opacity-40")}>
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}

/** Loads the next rows as soon as this comes into view (phones). */
export function LoadMoreSentinel({ onLoad, label }: { onLoad: () => void; label?: ReactNode }) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const onLoadRef = useRef(onLoad);
  onLoadRef.current = onLoad;

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) onLoadRef.current();
      },
      { rootMargin: "240px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="flex items-center justify-center gap-2 py-4 text-sm text-text-muted" role="status">
      <Loader2 size={16} className="animate-spin text-icon" aria-hidden="true" />
      {label ?? t("pager.loadingMore")}
      {/* Fallback for very old browsers without IntersectionObserver. */}
      {typeof IntersectionObserver === "undefined" ? (
        <button type="button" onClick={onLoad} className="ml-2 font-semibold text-primary">
          {t("pager.loadMore")}
        </button>
      ) : null}
    </div>
  );
}
