import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { BookOpen, Check, Copy, ExternalLink, MessageCircle, Package, Pencil, Plus, Search, Trash2 } from "lucide-react";
import clsx from "clsx";
import { Button } from "../../components/ui/Button";
import { Dialog } from "../../components/ui/Dialog";
import { inputClass } from "../../components/page/kit";
import { listProducts, type Product } from "../../lib/products-api";
import { catalogueLink, createCatalogue, deleteCatalogue, listCatalogues, updateCatalogue, type Catalogue, type CatalogueInput, type CataloguePrice } from "../../lib/catalogues-api";
import { ApiError } from "../../lib/api";
import { formatCurrency } from "../../lib/format";
import { showError, showSuccess } from "../../lib/toast";

/**
 * Catalogues: pick items, choose whether prices show, and send the link on
 * WhatsApp (customers see a clean page they can also print / save as PDF).
 */
export function CataloguesPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: ["catalogues"], queryFn: listCatalogues });
  const [editing, setEditing] = useState<Catalogue | "new" | null>(null);
  const [deleting, setDeleting] = useState<Catalogue | null>(null);

  const remove = useMutation({
    mutationFn: (id: string) => deleteCatalogue(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["catalogues"] });
      setDeleting(null);
      showSuccess(t("catalogue.deleted"));
    },
    onError: (err) => showError(err instanceof ApiError ? err.message : t("catalogue.failed")),
  });

  const share = (c: Catalogue) => {
    const text = t("catalogue.shareText", { title: c.title, link: catalogueLink(c.token) });
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  };
  const copy = async (c: Catalogue) => {
    try {
      await navigator.clipboard.writeText(catalogueLink(c.token));
      showSuccess(t("catalogue.linkCopied"));
    } catch {
      showError(t("catalogue.copyFailed"));
    }
  };

  const rows = list.data ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-text-muted">{t("catalogue.intro")}</p>
        <Button onClick={() => setEditing("new")}>
          <Plus size={18} aria-hidden="true" />
          {t("catalogue.new")}
        </Button>
      </div>

      {list.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-40 animate-pulse rounded-2xl bg-surface-variant" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-surface px-6 py-12 text-center shadow-card">
          <BookOpen size={36} strokeWidth={1.5} className="text-icon" aria-hidden="true" />
          <p className="mt-3 text-base font-bold text-text">{t("catalogue.emptyTitle")}</p>
          <p className="mt-1 max-w-md text-sm text-text-muted">{t("catalogue.emptyBody")}</p>
          <Button className="mt-5" onClick={() => setEditing("new")}>
            <Plus size={18} aria-hidden="true" />
            {t("catalogue.new")}
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((c) => (
            <article key={c._id} className="flex flex-col rounded-2xl border border-border bg-surface p-5 shadow-card">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-container text-primary">
                  <BookOpen size={20} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-base font-bold text-text">{c.title}</h3>
                  <p className="mt-0.5 text-xs text-text-muted">
                    {t("catalogue.itemsCount", { count: c.productCount ?? c.productIds.length })} · {t(`catalogue.priceMode.${c.price}`)}
                    {c.showStock ? ` · ${t("catalogue.withStock")}` : ""}
                  </p>
                </div>
              </div>
              {c.note ? <p className="mt-3 line-clamp-2 text-sm text-text-subtle">{c.note}</p> : null}
              <div className="mt-auto flex flex-wrap gap-2 pt-4">
                <Button className="flex-1" onClick={() => share(c)}>
                  <MessageCircle size={16} aria-hidden="true" />
                  {t("catalogue.shareWhatsApp")}
                </Button>
                <a
                  href={`/c/${c.token}`}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={t("catalogue.open")}
                  title={t("catalogue.open")}
                  className="flex h-11 w-11 items-center justify-center rounded-xl border border-border text-icon outline-none hover:text-text focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  <ExternalLink size={17} aria-hidden="true" />
                </a>
                <button type="button" onClick={() => void copy(c)} aria-label={t("catalogue.copyLink")} title={t("catalogue.copyLink")} className="flex h-11 w-11 items-center justify-center rounded-xl border border-border text-icon outline-none hover:text-text focus-visible:ring-2 focus-visible:ring-primary/40">
                  <Copy size={17} aria-hidden="true" />
                </button>
                <button type="button" onClick={() => setEditing(c)} aria-label={t("catalogue.edit")} title={t("catalogue.edit")} className="flex h-11 w-11 items-center justify-center rounded-xl border border-border text-icon outline-none hover:text-text focus-visible:ring-2 focus-visible:ring-primary/40">
                  <Pencil size={17} aria-hidden="true" />
                </button>
                <button type="button" onClick={() => setDeleting(c)} aria-label={t("catalogue.delete")} title={t("catalogue.delete")} className="flex h-11 w-11 items-center justify-center rounded-xl border border-border text-icon outline-none hover:text-danger focus-visible:ring-2 focus-visible:ring-primary/40">
                  <Trash2 size={17} aria-hidden="true" />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {editing ? <CatalogueBuilder initial={editing === "new" ? null : editing} onClose={() => setEditing(null)} /> : null}

      <Dialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={t("catalogue.deleteTitle")}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              {t("common.cancel")}
            </Button>
            <Button variant="danger" isLoading={remove.isPending} onClick={() => deleting && remove.mutate(deleting._id)}>
              {t("catalogue.delete")}
            </Button>
          </>
        }
      >
        <p className="text-sm text-text-muted">{t("catalogue.deleteBody", { title: deleting?.title ?? "" })}</p>
      </Dialog>
    </div>
  );
}

const PRICE_MODES: CataloguePrice[] = ["retail", "wholesale", "hidden"];

/** Make or change a catalogue: name, which price shows, which items. */
function CatalogueBuilder({ initial, onClose }: { initial: Catalogue | null; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const products = useQuery({ queryKey: ["products"], queryFn: () => listProducts() });
  const [title, setTitle] = useState(initial?.title ?? t("catalogue.defaultTitle"));
  const [note, setNote] = useState(initial?.note ?? "");
  const [price, setPrice] = useState<CataloguePrice>(initial?.price ?? "retail");
  const [showStock, setShowStock] = useState(initial?.showStock ?? false);
  const [picked, setPicked] = useState<Set<string>>(() => new Set(initial?.productIds ?? []));
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string | null>(null);

  const sellable = useMemo(() => (products.data ?? []).filter((p) => !p.isRawMaterial && p.isActive !== false), [products.data]);
  const categories = useMemo(() => [...new Set(sellable.map((p) => p.category).filter((c): c is string => Boolean(c)))].sort(), [sellable]);
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sellable.filter((p) => (!category || p.category === category) && (!q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)));
  }, [sellable, search, category]);
  const allShownPicked = shown.length > 0 && shown.every((p) => picked.has(p._id));

  const toggle = (id: string) =>
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleAllShown = () =>
    setPicked((current) => {
      const next = new Set(current);
      for (const p of shown) {
        if (allShownPicked) next.delete(p._id);
        else next.add(p._id);
      }
      return next;
    });

  const save = useMutation({
    mutationFn: () => {
      // Keep the order items appear in the list.
      const productIds = sellable.filter((p) => picked.has(p._id)).map((p) => p._id);
      const input: CatalogueInput = { title: title.trim(), note: note.trim() || undefined, productIds, price, showStock };
      return initial ? updateCatalogue(initial._id, input) : createCatalogue(input);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["catalogues"] });
      showSuccess(initial ? t("catalogue.saved") : t("catalogue.created"));
      onClose();
    },
    onError: (err) => showError(err instanceof ApiError ? err.message : t("catalogue.failed")),
  });

  const priceOf = (p: Product) => (price === "wholesale" ? p.wholesalePrice || p.retailPrice : p.retailPrice || p.wholesalePrice);

  return (
    <Dialog
      open
      onClose={onClose}
      title={initial ? t("catalogue.editTitle") : t("catalogue.newTitle")}
      footer={
        <>
          <span className="mr-auto text-sm font-medium text-text-muted">{t("catalogue.pickedCount", { count: picked.size })}</span>
          <Button variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button isLoading={save.isPending} disabled={picked.size === 0 || !title.trim()} onClick={() => save.mutate()}>
            {initial ? t("catalogue.save") : t("catalogue.create")}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <label className="block text-sm font-semibold text-text">
          {t("catalogue.titleLabel")}
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} className={clsx(inputClass, "mt-1.5")} />
        </label>
        <label className="block text-sm font-semibold text-text">
          {t("catalogue.noteLabel")}
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder={t("catalogue.notePlaceholder")} className={clsx(inputClass, "mt-1.5 font-normal")} />
        </label>

        <div>
          <p className="text-sm font-semibold text-text">{t("catalogue.priceLabel")}</p>
          <div className="mt-1.5 grid grid-cols-3 gap-2" role="radiogroup" aria-label={t("catalogue.priceLabel")}>
            {PRICE_MODES.map((mode) => (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={price === mode}
                onClick={() => setPrice(mode)}
                className={clsx(
                  "rounded-xl border px-2 py-2.5 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/40",
                  price === mode ? "border-primary bg-primary-container text-primary" : "border-border bg-surface text-text-subtle hover:bg-surface-muted"
                )}
              >
                {t(`catalogue.priceMode.${mode}`)}
              </button>
            ))}
          </div>
        </div>

        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-border px-3 py-2.5">
          <span>
            <span className="block text-sm font-semibold text-text">{t("catalogue.showStock")}</span>
            <span className="block text-xs text-text-muted">{t("catalogue.showStockHint")}</span>
          </span>
          <input type="checkbox" checked={showStock} onChange={(e) => setShowStock(e.target.checked)} className="h-5 w-5 accent-[var(--color-primary)]" />
        </label>

        {/* Items */}
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-text">{t("catalogue.itemsLabel")}</p>
            {shown.length > 0 ? (
              <button type="button" onClick={toggleAllShown} className="text-sm font-semibold text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary/40">
                {allShownPicked ? t("catalogue.unselectShown") : t("catalogue.selectShown")}
              </button>
            ) : null}
          </div>
          <div className="mt-2 flex h-10 items-center gap-2 rounded-xl border border-border bg-surface-muted px-3">
            <Search size={16} className="shrink-0 text-icon" aria-hidden="true" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("catalogue.searchItems")} aria-label={t("catalogue.searchItems")} className="h-full w-full bg-transparent text-sm outline-none placeholder:text-text-placeholder" />
          </div>
          {categories.length > 0 ? (
            <div className="scrollbar-hide mt-2 flex gap-1.5 overflow-x-auto">
              {[null, ...categories].map((c) => (
                <button
                  key={c ?? "all"}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={clsx(
                    "h-8 shrink-0 rounded-full border px-3 text-xs font-semibold outline-none",
                    category === c ? "border-primary/30 bg-primary-container text-primary" : "border-border bg-surface text-text-subtle"
                  )}
                >
                  {c ?? t("catalogue.allCategories")}
                </button>
              ))}
            </div>
          ) : null}

          <ul className="mt-2 max-h-72 divide-y divide-border overflow-y-auto rounded-xl border border-border">
            {products.isLoading ? (
              <li className="px-3 py-4 text-sm text-text-muted">{t("common.loading")}</li>
            ) : shown.length === 0 ? (
              <li className="px-3 py-4 text-sm text-text-muted">{t("catalogue.noItems")}</li>
            ) : (
              shown.map((p) => {
                const on = picked.has(p._id);
                return (
                  <li key={p._id}>
                    <button type="button" onClick={() => toggle(p._id)} aria-pressed={on} className={clsx("flex w-full items-center gap-3 px-3 py-2 text-left outline-none hover:bg-surface-muted focus-visible:bg-surface-muted", on && "bg-primary-container/40")}>
                      <span className={clsx("flex h-5 w-5 shrink-0 items-center justify-center rounded-md border", on ? "border-primary bg-primary text-white" : "border-border bg-surface")}>
                        {on ? <Check size={13} strokeWidth={3} aria-hidden="true" /> : null}
                      </span>
                      {p.imageUrl ? (
                        <img src={p.imageUrl} alt="" className="h-9 w-9 shrink-0 rounded-lg border border-border object-cover" />
                      ) : (
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-icon">
                          <Package size={16} aria-hidden="true" />
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-text">{p.name}</span>
                        <span className="block truncate text-xs text-text-muted">{p.category ?? p.sku}</span>
                      </span>
                      <span className="shrink-0 text-sm tabular-nums text-text-subtle">{price === "hidden" ? "—" : formatCurrency(priceOf(p) ?? 0)}</span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      </div>
    </Dialog>
  );
}
