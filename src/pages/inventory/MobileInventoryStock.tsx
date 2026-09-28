import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { AlertTriangle, Ban, CheckCircle2, Package, PackagePlus, Plus, Warehouse } from "lucide-react";
import { SearchInput } from "../../components/ui/SearchInput";
import { Dialog } from "../../components/ui/Dialog";
import { Button } from "../../components/ui/Button";
import { listProducts, type Product } from "../../lib/products-api";
import { createStockMovement, getStockLevels, listWarehouses, type CreateMovementInput } from "../../lib/stock-api";
import { StockForm } from "./StockForm";
import { ProductForm } from "./ProductForm";
import { createProduct, type ProductInput } from "../../lib/products-api";
import { formatCurrency } from "../../lib/format";

type StatusFilter = "all" | "low" | "out";

function stockStatus(quantity: number, reorderLevel: number): "normal" | "low" | "out" {
  if (quantity <= 0) return "out";
  if (quantity <= reorderLevel) return "low";
  return "normal";
}

const statusBadge: Record<"normal" | "low" | "out", { label: string; className: string; icon: typeof CheckCircle2 }> = {
  normal: { label: "In Stock", className: "bg-success-container text-success", icon: CheckCircle2 },
  low: { label: "Low Stock", className: "bg-warning-container text-warning", icon: AlertTriangle },
  out: { label: "Out of Stock", className: "bg-danger-container text-danger", icon: Ban },
};

export function MobileInventoryStock() {
  const queryClient = useQueryClient();
  const [warehouseFilter, setWarehouseFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [stockProduct, setStockProduct] = useState<Product | null>(null);
  const [addProductOpen, setAddProductOpen] = useState(false);

  const productsQuery = useQuery({ queryKey: ["products"], queryFn: listProducts });
  const stockLevelsQuery = useQuery({ queryKey: ["stock-levels"], queryFn: getStockLevels });
  const warehousesQuery = useQuery({ queryKey: ["warehouses"], queryFn: listWarehouses });

  const stockMutation = useMutation({
    mutationFn: (input: CreateMovementInput) => createStockMovement(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock-levels"] });
      queryClient.invalidateQueries({ queryKey: ["stock-level", stockProduct?._id] });
      setStockProduct(null);
    },
  });

  const createProductMutation = useMutation({
    mutationFn: (input: ProductInput) => createProduct(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setAddProductOpen(false);
    },
  });

  const products = productsQuery.data ?? [];
  const stockLevels = stockLevelsQuery.data ?? {};
  const warehouses = warehousesQuery.data ?? [];

  const quantityFor = (product: Product): number => {
    const level = stockLevels[product._id];
    if (!level) return 0;
    if (warehouseFilter === "all") return level.total;
    return level.warehouses[warehouseFilter] ?? 0;
  };

  const totals = useMemo(() => {
    let valuation = 0;
    let lowCount = 0;
    let outCount = 0;
    for (const p of products) {
      const qty = quantityFor(p);
      valuation += Math.max(0, qty) * p.wholesalePrice;
      const status = stockStatus(qty, p.reorderLevel);
      if (status === "low") lowCount += 1;
      if (status === "out") outCount += 1;
    }
    return { valuation, lowCount, outCount, totalSkus: products.length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, stockLevels, warehouseFilter]);

  const warehouseTabs = [
    { key: "all", label: "All Warehouses", count: totals.totalSkus },
    ...warehouses.map((w) => ({ key: w._id, label: w.name, count: null as number | null })),
  ];

  const statusFilters: { key: StatusFilter; label: string; dotClass: string | null }[] = [
    { key: "all", label: `All (${totals.totalSkus})`, dotClass: null },
    { key: "low", label: `Low Stock (${totals.lowCount})`, dotClass: "bg-warning" },
    { key: "out", label: `Out of Stock (${totals.outCount})`, dotClass: "bg-danger" },
  ];

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return products.filter((p) => {
      const qty = quantityFor(p);
      const status = stockStatus(qty, p.reorderLevel);
      const matchesStatus = statusFilter === "all" || status === statusFilter;
      const matchesSearch =
        !query || p.name.toLowerCase().includes(query) || p.sku.toLowerCase().includes(query);
      return matchesStatus && matchesSearch;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, statusFilter, search, stockLevels, warehouseFilter]);

  const isLoading = productsQuery.isLoading || stockLevelsQuery.isLoading;

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-border bg-surface p-3.5 shadow-elevation-1">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Warehouse size={20} className="text-primary" />
            <span className="font-headline text-[15px] font-semibold text-text">Inventory &amp; Warehouses</span>
          </div>
          <button
            type="button"
            onClick={() => setAddProductOpen(true)}
            className="flex items-center gap-1 rounded-full bg-primary-container px-2.5 py-1 text-primary outline-none transition-colors hover:bg-primary-container/80 focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <Plus size={14} />
            <span className="font-label text-[10px] font-semibold tracking-wide">Add Product</span>
          </button>
        </div>

        <div className="scrollbar-hide flex items-center gap-2 overflow-x-auto pb-1">
          {warehouseTabs.map((wh) => (
            <button
              key={wh.key}
              type="button"
              onClick={() => setWarehouseFilter(wh.key)}
              className={clsx(
                "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 font-label text-xs font-medium outline-none transition-all focus-visible:ring-2 focus-visible:ring-primary/40",
                warehouseFilter === wh.key
                  ? "bg-primary text-on-primary shadow-elevation-1"
                  : "border border-border bg-surface text-text-muted hover:bg-surface-muted"
              )}
            >
              <span>{wh.label}</span>
              {wh.count != null && (
                <span
                  className={clsx(
                    "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                    warehouseFilter === wh.key ? "bg-on-primary/25" : "bg-surface-muted text-text-muted"
                  )}
                >
                  {wh.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="flex flex-col justify-between rounded-xl border border-border bg-surface p-3 shadow-elevation-1">
          <div className="flex items-center justify-between">
            <span className="font-label text-[10px] font-semibold tracking-wider text-text-muted">VALUATION</span>
          </div>
          <div className="mt-1.5">
            <div className="font-headline text-base font-bold tracking-tight text-text">
              {formatCurrency(totals.valuation)}
            </div>
          </div>
        </div>
        <div className="flex flex-col justify-between rounded-xl border border-border bg-surface p-3 shadow-elevation-1">
          <div className="flex items-center justify-between">
            <span className="font-label text-[10px] font-semibold tracking-wider text-text-muted">TOTAL SKUS</span>
          </div>
          <div className="mt-1.5">
            <div className="font-headline text-base font-bold tracking-tight text-text">{totals.totalSkus}</div>
          </div>
        </div>
        <div
          className={clsx(
            "flex flex-col justify-between rounded-xl border p-3 shadow-elevation-1",
            totals.lowCount + totals.outCount > 0
              ? "border-danger-container bg-danger-container/30"
              : "border-border bg-surface"
          )}
        >
          <div className="flex items-center justify-between">
            <span
              className={clsx(
                "font-label text-[10px] font-semibold tracking-wider",
                totals.lowCount + totals.outCount > 0 ? "text-danger" : "text-text-muted"
              )}
            >
              REORDER
            </span>
            {totals.lowCount + totals.outCount > 0 && <AlertTriangle size={16} className="text-danger" />}
          </div>
          <div className="mt-1.5">
            <div
              className={clsx(
                "font-headline text-base font-bold tracking-tight",
                totals.lowCount + totals.outCount > 0 ? "text-danger" : "text-text"
              )}
            >
              {totals.lowCount + totals.outCount} Items
            </div>
            {totals.outCount > 0 && (
              <div className="font-label text-[11px] font-medium text-danger">{totals.outCount} Out of stock</div>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <SearchInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or SKU..."
        />
      </div>

      <div className="scrollbar-hide flex items-center gap-1.5 overflow-x-auto pb-0.5">
        {statusFilters.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setStatusFilter(f.key)}
            className={clsx(
              "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 font-label text-xs font-semibold tracking-wide outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/40",
              statusFilter === f.key
                ? "bg-text text-surface shadow-elevation-1"
                : "border border-border bg-surface text-text-muted hover:bg-surface-muted"
            )}
          >
            {f.dotClass ? <span className={clsx("h-2 w-2 rounded-full", f.dotClass)} /> : null}
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="py-8 text-center text-sm text-text-muted">Loading inventory…</p>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-surface py-12 text-center">
          <Package size={22} className="text-text-muted" strokeWidth={1.5} />
          <p className="mt-2 text-sm font-medium text-text">
            {products.length === 0 ? "No products yet" : "No matching products"}
          </p>
          <p className="mt-0.5 text-xs text-text-muted">
            {products.length === 0 ? "Add your first product to start tracking stock." : "Try a different search or filter."}
          </p>
          {products.length === 0 && (
            <Button className="mt-3" onClick={() => setAddProductOpen(true)}>
              Add product
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-col space-y-3">
          {filtered.map((product) => (
            <SkuCard
              key={product._id}
              product={product}
              quantity={quantityFor(product)}
              warehouseBreakdown={stockLevels[product._id]?.warehouses ?? {}}
              warehouses={warehouses}
              onAddStock={() => setStockProduct(product)}
            />
          ))}
        </div>
      )}

      <Dialog open={stockProduct !== null} onClose={() => setStockProduct(null)} title="Add / adjust stock">
        {stockProduct ? (
          <StockForm
            key={stockProduct._id}
            product={stockProduct}
            onCancel={() => setStockProduct(null)}
            onSubmit={(input) => stockMutation.mutateAsync({ ...input, productId: stockProduct._id })}
          />
        ) : null}
      </Dialog>

      <Dialog open={addProductOpen} onClose={() => setAddProductOpen(false)} title="Add product">
        <ProductForm onCancel={() => setAddProductOpen(false)} onSubmit={(input) => createProductMutation.mutateAsync(input)} />
      </Dialog>
    </div>
  );
}

function SkuCard({
  product,
  quantity,
  warehouseBreakdown,
  warehouses,
  onAddStock,
}: {
  product: Product;
  quantity: number;
  warehouseBreakdown: Record<string, number>;
  warehouses: { _id: string; name: string }[];
  onAddStock: () => void;
}) {
  const status = stockStatus(quantity, product.reorderLevel);
  const badge = statusBadge[status];
  const warehouseNameById = new Map(warehouses.map((w) => [w._id, w.name]));
  const splitLabel =
    Object.keys(warehouseBreakdown).length > 0
      ? Object.entries(warehouseBreakdown)
          .map(([id, qty]) => `${warehouseNameById.get(id) ?? "—"}: ${qty}`)
          .join(" | ")
      : "No stock recorded";

  return (
    <div className="flex flex-col space-y-3 rounded-2xl border border-border bg-surface p-4 shadow-elevation-1">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-3">
          <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-muted">
            <Package size={22} className="text-text-muted" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="truncate text-sm font-semibold text-text">{product.name}</span>
            </div>
            <div className="mt-0.5 flex items-center gap-1.5">
              <span className="font-label text-xs font-bold text-primary">SKU: {product.sku}</span>
              {product.category ? (
                <>
                  <span className="text-border">•</span>
                  <span className="text-xs text-text-muted">{product.category}</span>
                </>
              ) : null}
            </div>
          </div>
        </div>
        <span
          className={clsx(
            "flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 font-label text-[11px] font-semibold",
            badge.className
          )}
        >
          <badge.icon size={13} /> {badge.label}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 rounded-xl border border-border bg-surface-muted p-2.5">
        <StatCell label="ON HAND" value={`${quantity} ${product.unit}`} />
        <StatCell label="WAREHOUSE SPLIT" value={splitLabel} small />
        <StatCell label="PRICE" value={formatCurrency(product.wholesalePrice)} />
      </div>

      <div className="grid grid-cols-1 gap-2 pt-1">
        <button
          type="button"
          onClick={onAddStock}
          className="flex items-center justify-center gap-1.5 rounded-xl bg-primary py-2 font-label text-xs font-semibold text-on-primary shadow-elevation-1 transition-all active:scale-95 hover:bg-primary-hover"
        >
          <PackagePlus size={16} /> Add / Adjust Stock
        </button>
      </div>
    </div>
  );
}

function StatCell({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div className="flex flex-col">
      <span className="font-label text-[10px] font-semibold tracking-wider text-text-muted">{label}</span>
      <span
        className={clsx(
          "mt-0.5 truncate font-semibold text-text",
          small ? "font-label text-[10px]" : "font-label text-sm"
        )}
      >
        {value}
      </span>
    </div>
  );
}
