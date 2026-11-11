import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Trans, useTranslation } from "react-i18next";
import { AlertTriangle, Boxes, Factory, Hammer, Package, PackagePlus, PackageX, Plus, QrCode, ShoppingCart, SquarePen, Trash2 } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Dialog } from "../../components/ui/Dialog";
import { IconChip } from "../../components/ui/IconChip";
import { SearchInput } from "../../components/ui/SearchInput";
import { Tabs } from "../../components/ui/Tabs";
import { deleteProduct, listProducts, type Product } from "../../lib/products-api";
import { assembleProduct } from "../../lib/assembly-api";
import { createStockMovement, getStockLevels, type CreateMovementInput } from "../../lib/stock-api";
import { MobileInventoryStock } from "./MobileInventoryStock";
import { StockForm } from "./StockForm";
import { AssembleForm } from "./AssembleForm";
import { ProductQrModal } from "../../components/inventory/ProductQrModal";
import { NewPurchaseModal } from "../../components/purchases/NewPurchaseModal";
import { EmptyHelp, FilterChips, LoadingRows, PageGuide, PageIntro, StatusPill, SummaryRow, SummaryTile, TableShell, Th } from "../../components/page/kit";
import { initialParam } from "../../lib/url-params";
import { InventoryExtraActions } from "../../components/inventory/InventoryExtraActions";
import { ExpiringPanel } from "../../components/inventory/ExpiringPanel";

type StockFilter = "all" | "low" | "out" | "ok";

const currency = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export function InventoryPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const inventoryTabs = [
    { key: "products", label: t("inventory.tabs.products") },
    { key: "raw-materials", label: t("inventory.tabs.rawMaterials") },
  ];
  const [tab, setTab] = useState("products");
  const [search, setSearch] = useState(() => initialParam("q"));
  const [pendingDelete, setPendingDelete] = useState<Product | null>(null);
  const [stockProduct, setStockProduct] = useState<Product | null>(null);
  const [qrProduct, setQrProduct] = useState<Product | null>(null);
  const [assembleProductState, setAssembleProductState] = useState<Product | null>(null);
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");
  const [purchaseOpen, setPurchaseOpen] = useState(false);

  const { data: products, isLoading, isError } = useQuery({
    queryKey: ["products"],
    queryFn: () => listProducts(),
  });

  const { data: stockLevels } = useQuery({
    queryKey: ["stock-levels"],
    queryFn: getStockLevels,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteProduct(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setPendingDelete(null);
    },
  });

  const stockMutation = useMutation({
    mutationFn: (input: CreateMovementInput) => createStockMovement(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock-levels"] });
      queryClient.invalidateQueries({ queryKey: ["stock-level", stockProduct?._id] });
      setStockProduct(null);
    },
  });

  const assembleMutation = useMutation({
    mutationFn: (input: { warehouseId: string; quantity: number; note?: string }) =>
      assembleProduct({ ...input, productId: assembleProductState!._id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock-levels"] });
      queryClient.invalidateQueries({ queryKey: ["producible", assembleProductState?._id] });
      setAssembleProductState(null);
    },
  });

  const scoped = useMemo(() => {
    if (!products) return [];
    return products.filter((p) => (tab === "raw-materials" ? p.isRawMaterial : !p.isRawMaterial));
  }, [products, tab]);

  const qtyOf = (product: Product) => stockLevels?.[product._id]?.total ?? 0;
  const stateOf = (product: Product): "out" | "low" | "ok" => {
    const qty = qtyOf(product);
    if (qty <= 0) return "out";
    if (qty <= product.reorderLevel) return "low";
    return "ok";
  };

  const summary = useMemo(() => {
    const qty = (p: Product) => stockLevels?.[p._id]?.total ?? 0;
    return {
      count: scoped.length,
      value: scoped.reduce((sum, p) => sum + Math.max(0, qty(p)) * (p.purchasePrice ?? 0), 0),
      low: scoped.filter((p) => qty(p) > 0 && qty(p) <= p.reorderLevel).length,
      out: scoped.filter((p) => qty(p) <= 0).length,
    };
  }, [scoped, stockLevels]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const qty = (p: Product) => stockLevels?.[p._id]?.total ?? 0;
    const state = (p: Product) => (qty(p) <= 0 ? "out" : qty(p) <= p.reorderLevel ? "low" : "ok");
    return scoped
      .filter(
        (p) =>
          !query ||
          p.name.toLowerCase().includes(query) ||
          p.sku.toLowerCase().includes(query) ||
          p.category?.toLowerCase().includes(query) ||
          p.barcode?.toLowerCase().includes(query)
      )
      .filter((p) => stockFilter === "all" || state(p) === stockFilter);
  }, [scoped, search, stockFilter, stockLevels]);

  const addPath = tab === "raw-materials" ? "/app/inventory/new?type=raw-material" : "/app/inventory/new";
  const addLabel = tab === "raw-materials" ? t("inventory.inventoryPage.addRawMaterial") : t("inventory.inventoryPage.addProduct");
  const actionButton =
    "rounded-lg p-2 text-text-muted outline-none transition-colors hover:bg-surface-variant hover:text-text focus-visible:ring-2 focus-visible:ring-primary/40";

  return (
    <>
      <div className="lg:hidden">
        <MobileInventoryStock />
      </div>

      <div className="hidden space-y-5 lg:block">
      <PageIntro text={t("inventory.hub.intro")}>
        <InventoryExtraActions />
        <Button variant="secondary" onClick={() => setPurchaseOpen(true)}>
          <ShoppingCart size={16} className="mr-1.5" aria-hidden="true" />
          {t("inventory.hub.recordPurchase")}
        </Button>
        <Button onClick={() => navigate(addPath)}>
          <Plus size={16} className="mr-1.5" strokeWidth={2} aria-hidden="true" />
          {addLabel}
        </Button>
      </PageIntro>

      <SummaryRow>
        <SummaryTile label={t("inventory.hub.summary.count")} value={String(summary.count)} detail={t("inventory.hub.summary.countDetail")} icon={Package} tone="info" onClick={() => setStockFilter("all")} />
        <SummaryTile label={t("inventory.hub.summary.value")} value={currency.format(summary.value)} detail={t("inventory.hub.summary.valueDetail")} icon={Boxes} tone="primary" />
        <SummaryTile label={t("inventory.hub.summary.low")} value={String(summary.low)} detail={t("inventory.hub.summary.lowDetail")} icon={AlertTriangle} tone="warning" onClick={() => setStockFilter("low")} />
        <SummaryTile label={t("inventory.hub.summary.out")} value={String(summary.out)} detail={t("inventory.hub.summary.outDetail")} icon={PackageX} tone="danger" onClick={() => setStockFilter("out")} />
      </SummaryRow>

      <ExpiringPanel />

      <PageGuide
        storageKey="inventory"
        title={t("inventory.guide.title")}
        subtitle={t("inventory.guide.subtitle")}
        stepLabel={(number) => t("sales.guide.step", { number })}
        steps={[
          { icon: Package, tone: "info", title: t("inventory.guide.add.title"), body: t("inventory.guide.add.body"), action: { label: t("inventory.inventoryPage.addProduct"), onClick: () => navigate("/app/inventory/new") } },
          { icon: PackagePlus, tone: "primary", title: t("inventory.guide.stockIn.title"), body: t("inventory.guide.stockIn.body"), action: { label: t("inventory.hub.recordPurchase"), onClick: () => setPurchaseOpen(true) } },
          { icon: AlertTriangle, tone: "warning", title: t("inventory.guide.watch.title"), body: t("inventory.guide.watch.body") },
          { icon: Factory, tone: "success", title: t("inventory.guide.make.title"), body: t("inventory.guide.make.body") },
        ]}
        terms={[
          { term: t("inventory.guide.terms.cost"), meaning: t("inventory.guide.terms.costMeaning") },
          { term: t("inventory.guide.terms.reorder"), meaning: t("inventory.guide.terms.reorderMeaning") },
          { term: t("inventory.guide.terms.sku"), meaning: t("inventory.guide.terms.skuMeaning") },
        ]}
      />

      <div className="flex flex-wrap items-center gap-3">
        <Tabs tabs={inventoryTabs} active={tab} onChange={setTab} />
        <div className="w-72">
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("inventory.inventoryPage.searchPlaceholder")}
          />
        </div>
        <div className="ml-auto">
          <FilterChips
            label={t("inventory.hub.stockLabel")}
            value={stockFilter}
            onChange={setStockFilter}
            options={[
              { key: "all", label: t("inventory.hub.filter.all") },
              { key: "low", label: t("inventory.hub.filter.low"), count: summary.low },
              { key: "out", label: t("inventory.hub.filter.out"), count: summary.out },
              { key: "ok", label: t("inventory.hub.filter.ok") },
            ]}
          />
        </div>
      </div>

      {isLoading ? (
        <LoadingRows />
      ) : isError ? (
        <div className="rounded-2xl bg-surface p-6 text-sm text-danger shadow-elevation-1">
          {t("inventory.inventoryPage.loadFailed")}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyHelp
          icon={Package}
          title={
            scoped.length > 0
              ? t("inventory.inventoryPage.noMatchingResults")
              : tab === "raw-materials"
                ? t("inventory.inventoryPage.noRawMaterialsYet")
                : t("inventory.inventoryPage.noProductsYet")
          }
          body={
            scoped.length > 0
              ? t("inventory.hub.noMatchBody")
              : tab === "raw-materials"
                ? t("inventory.inventoryPage.noRawMaterialsDescription")
                : t("inventory.hub.emptyBody")
          }
          action={scoped.length === 0 ? <Button onClick={() => navigate(addPath)}>{addLabel}</Button> : undefined}
        />
      ) : (
        <TableShell
          footer={
            <>
              <span className="text-text-muted">{t("inventory.hub.footer.count", { count: filtered.length })}</span>
              <span className="font-bold text-text">
                {t("inventory.hub.footer.value")}:{" "}
                {currency.format(filtered.reduce((sum, p) => sum + Math.max(0, qtyOf(p)) * (p.purchasePrice ?? 0), 0))}
              </span>
            </>
          }
        >
          <thead>
            <tr className="border-b border-border">
              <Th>{t("inventory.inventoryPage.columnProduct")}</Th>
              <Th align="right">{t("inventory.inventoryPage.columnStock")}</Th>
              <Th align="right">{t("inventory.hub.col.cost")}</Th>
              <Th align="right">{t("inventory.inventoryPage.columnWholesale")}</Th>
              <Th align="right">{t("inventory.inventoryPage.columnRetail")}</Th>
              <Th align="right">{t("inventory.hub.col.margin")}</Th>
              <Th align="right">{t("inventory.hub.col.value")}</Th>
              <Th align="right">{t("inventory.hub.col.actions")}</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((product) => {
              const qty = qtyOf(product);
              const state = stateOf(product);
              const margin = product.purchasePrice > 0 ? ((product.wholesalePrice - product.purchasePrice) / product.purchasePrice) * 100 : null;
              return (
                <tr key={product._id} className="hover:bg-surface-muted">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {product.imageUrl ? (
                        <img src={product.imageUrl} alt="" className="h-10 w-10 shrink-0 rounded-lg border border-border object-cover" />
                      ) : (
                        <IconChip>
                          <Package size={16} strokeWidth={1.75} />
                        </IconChip>
                      )}
                      <div className="min-w-0">
                        <p className="font-semibold text-text">{product.name}</p>
                        <p className="text-xs text-text-muted">
                          {product.sku}
                          {product.category ? ` · ${product.category}` : ""}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="font-bold tabular-nums text-text">
                      {qty} <span className="text-xs font-semibold text-text-muted">{product.unit}</span>
                    </p>
                    <div className="mt-1">
                      <StatusPill tone={state === "out" ? "danger" : state === "low" ? "warning" : "success"}>
                        {state === "out"
                          ? t("inventory.hub.state.out")
                          : state === "low"
                            ? t("inventory.hub.state.low", { level: product.reorderLevel })
                            : t("inventory.hub.state.ok")}
                      </StatusPill>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-text">{currency.format(product.purchasePrice)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-text">{currency.format(product.wholesalePrice)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-text">{currency.format(product.retailPrice)}</td>
                  <td className={`px-4 py-3 text-right font-semibold tabular-nums ${margin === null ? "text-text-muted" : margin < 0 ? "text-danger" : "text-success"}`}>
                    {margin === null ? "—" : `${margin.toFixed(0)}%`}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-text">{currency.format(Math.max(0, qty) * product.purchasePrice)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => setStockProduct(product)}
                        aria-label={t("inventory.inventoryPage.addOrAdjustStockFor", { name: product.name })}
                        className="mr-1 inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-sm font-semibold text-text outline-none hover:border-primary hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/40"
                      >
                        <Boxes size={15} aria-hidden="true" />
                        {t("inventory.hub.stockInOut")}
                      </button>
                      {product.bom.length > 0 ? (
                        <button
                          type="button"
                          aria-label={t("inventory.inventoryPage.assembleFor", { name: product.name })}
                          title={t("inventory.inventoryPage.assembleFor", { name: product.name })}
                          onClick={() => setAssembleProductState(product)}
                          className={actionButton}
                        >
                          <Hammer size={16} />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        aria-label={t("inventory.inventoryPage.viewQrFor", { name: product.name })}
                        title={t("inventory.inventoryPage.viewQrFor", { name: product.name })}
                        onClick={() => setQrProduct(product)}
                        className={actionButton}
                      >
                        <QrCode size={16} />
                      </button>
                      <button
                        type="button"
                        aria-label={t("inventory.inventoryPage.editFor", { name: product.name })}
                        title={t("inventory.inventoryPage.editFor", { name: product.name })}
                        onClick={() => navigate(`/app/inventory/${product._id}/edit`)}
                        className={actionButton}
                      >
                        <SquarePen size={16} />
                      </button>
                      <button
                        type="button"
                        aria-label={t("inventory.inventoryPage.deleteFor", { name: product.name })}
                        title={t("inventory.inventoryPage.deleteFor", { name: product.name })}
                        onClick={() => setPendingDelete(product)}
                        className={`${actionButton} hover:text-danger`}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </TableShell>
      )}
      </div>

      <Dialog open={stockProduct !== null} onClose={() => setStockProduct(null)} title={t("inventory.inventoryPage.addOrAdjustStockTitle")}>
        {stockProduct ? (
          <StockForm
            key={stockProduct._id}
            product={stockProduct}
            onCancel={() => setStockProduct(null)}
            onSubmit={(input) => stockMutation.mutateAsync({ ...input, productId: stockProduct._id })}
          />
        ) : null}
      </Dialog>

      <Dialog
        open={assembleProductState !== null}
        onClose={() => setAssembleProductState(null)}
        title={t("inventory.inventoryPage.assembleTitle")}
      >
        {assembleProductState ? (
          <AssembleForm
            key={assembleProductState._id}
            product={assembleProductState}
            onCancel={() => setAssembleProductState(null)}
            onSubmit={(input) => assembleMutation.mutateAsync(input)}
          />
        ) : null}
      </Dialog>

      <Dialog open={pendingDelete !== null} onClose={() => setPendingDelete(null)} title={t("inventory.inventoryPage.deleteProductTitle")}>
        <p className="text-sm text-text-muted">
          <Trans
            i18nKey="inventory.inventoryPage.deleteConfirm"
            values={{ name: pendingDelete?.name }}
            components={{ bold: <span className="font-medium text-text" /> }}
          />
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setPendingDelete(null)}>
            {t("inventory.inventoryPage.cancel")}
          </Button>
          <Button
            variant="danger"
            onClick={() => pendingDelete && deleteMutation.mutate(pendingDelete._id)}
            isLoading={deleteMutation.isPending}
          >
            {t("inventory.inventoryPage.delete")}
          </Button>
        </div>
      </Dialog>

      <NewPurchaseModal open={purchaseOpen} onClose={() => setPurchaseOpen(false)} />

      <ProductQrModal
        productId={qrProduct?._id ?? null}
        productName={qrProduct?.name}
        onClose={() => setQrProduct(null)}
      />
    </>
  );
}
