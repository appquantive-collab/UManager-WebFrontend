import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Boxes, Hammer, Package, Plus, QrCode, SquarePen, Trash2 } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Dialog } from "../../components/ui/Dialog";
import { EmptyState } from "../../components/ui/EmptyState";
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

const inventoryTabs = [
  { key: "products", label: "Products" },
  { key: "raw-materials", label: "Raw Materials" },
];

const currency = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

const chipColors = ["#3b82f6", "#22c55e", "#f59e0b", "#a855f7", "#ef4444", "#06b6d4"];

function colorForCategory(category?: string): string {
  if (!category) return chipColors[0];
  let hash = 0;
  for (let i = 0; i < category.length; i++) hash = (hash << 5) - hash + category.charCodeAt(i);
  return chipColors[Math.abs(hash) % chipColors.length];
}

export function InventoryPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [tab, setTab] = useState("products");
  const [search, setSearch] = useState("");
  const [pendingDelete, setPendingDelete] = useState<Product | null>(null);
  const [stockProduct, setStockProduct] = useState<Product | null>(null);
  const [qrProduct, setQrProduct] = useState<Product | null>(null);
  const [assembleProductState, setAssembleProductState] = useState<Product | null>(null);

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

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return scoped;
    return scoped.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.sku.toLowerCase().includes(query) ||
        p.category?.toLowerCase().includes(query)
    );
  }, [scoped, search]);

  return (
    <>
      <div className="lg:hidden">
        <MobileInventoryStock />
      </div>

      <div className="hidden space-y-6 lg:block">
      <div className="flex items-center justify-between gap-3">
        <Tabs tabs={inventoryTabs} active={tab} onChange={setTab} />
        <Button onClick={() => navigate(tab === "raw-materials" ? "/app/inventory/new?type=raw-material" : "/app/inventory/new")}>
          <Plus size={16} className="mr-1.5" strokeWidth={2} />
          {tab === "raw-materials" ? "Add raw material" : "Add product"}
        </Button>
      </div>

      <div className="max-w-sm">
        <SearchInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, SKU, or category"
        />
      </div>

      {isLoading ? (
        <div className="rounded-2xl bg-surface p-6 text-sm text-text-muted shadow-elevation-1">Loading products…</div>
      ) : isError ? (
        <div className="rounded-2xl bg-surface p-6 text-sm text-danger shadow-elevation-1">
          Failed to load products. Please try again.
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Package}
          title={scoped.length > 0 ? "No matching results" : tab === "raw-materials" ? "No raw materials yet" : "No products yet"}
          description={
            scoped.length > 0
              ? "Try a different search term."
              : tab === "raw-materials"
                ? "Add raw materials here, then reference them in a product's Bill of Materials."
                : "Add your first product to start tracking inventory, pricing, and stock."
          }
          action={
            scoped.length === 0 ? (
              <Button
                onClick={() => navigate(tab === "raw-materials" ? "/app/inventory/new?type=raw-material" : "/app/inventory/new")}
              >
                {tab === "raw-materials" ? "Add raw material" : "Add product"}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-surface shadow-elevation-1">
          <table className="w-full min-w-max text-sm">
            <thead>
              <tr className="text-left text-xs font-medium uppercase tracking-wide text-text-muted">
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3 text-right">Stock</th>
                <th className="px-4 py-3 text-right">Purchase</th>
                <th className="px-4 py-3 text-right">Wholesale</th>
                <th className="px-4 py-3 text-right">Retail</th>
                <th className="px-4 py-3 text-right">Reorder Level</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-variant">
              {filtered.map((product) => (
                <tr key={product._id} className="hover:bg-surface-muted">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {product.imageUrl ? (
                        <img
                          src={product.imageUrl}
                          alt=""
                          className="h-8 w-8 shrink-0 rounded-lg border border-border object-cover"
                        />
                      ) : (
                        <IconChip color={colorForCategory(product.category)}>
                          <Package size={16} strokeWidth={1.75} />
                        </IconChip>
                      )}
                      <span className="font-medium text-text">{product.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-text-muted">{product.sku}</td>
                  <td className="px-4 py-3 text-text-muted">{product.category || "—"}</td>
                  <td className="px-4 py-3 text-right">
                    {(() => {
                      const qty = stockLevels?.[product._id]?.total ?? 0;
                      const low = qty <= product.reorderLevel;
                      return (
                        <span className={low ? "font-medium text-danger" : "text-text"}>{qty}</span>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-3 text-right text-text">{currency.format(product.purchasePrice)}</td>
                  <td className="px-4 py-3 text-right text-text">{currency.format(product.wholesalePrice)}</td>
                  <td className="px-4 py-3 text-right text-text">{currency.format(product.retailPrice)}</td>
                  <td className="px-4 py-3 text-right text-text-muted">{product.reorderLevel}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        aria-label={`Add or adjust stock for ${product.name}`}
                        onClick={() => setStockProduct(product)}
                        className="rounded-md p-1.5 text-text-muted outline-none transition-colors hover:bg-surface hover:text-text focus-visible:ring-2 focus-visible:ring-primary/40"
                      >
                        <Boxes size={16} />
                      </button>
                      {product.bom.length > 0 ? (
                        <button
                          type="button"
                          aria-label={`Assemble ${product.name} from raw materials`}
                          onClick={() => setAssembleProductState(product)}
                          className="rounded-md p-1.5 text-text-muted outline-none transition-colors hover:bg-surface hover:text-text focus-visible:ring-2 focus-visible:ring-primary/40"
                        >
                          <Hammer size={16} />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        aria-label={`View QR code for ${product.name}`}
                        onClick={() => setQrProduct(product)}
                        className="rounded-md p-1.5 text-text-muted outline-none transition-colors hover:bg-surface hover:text-text focus-visible:ring-2 focus-visible:ring-primary/40"
                      >
                        <QrCode size={16} />
                      </button>
                      <button
                        type="button"
                        aria-label={`Edit ${product.name}`}
                        onClick={() => navigate(`/app/inventory/${product._id}/edit`)}
                        className="rounded-md p-1.5 text-text-muted outline-none transition-colors hover:bg-surface hover:text-text focus-visible:ring-2 focus-visible:ring-primary/40"
                      >
                        <SquarePen size={16} />
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete ${product.name}`}
                        onClick={() => setPendingDelete(product)}
                        className="rounded-md p-1.5 text-text-muted outline-none transition-colors hover:bg-surface hover:text-danger focus-visible:ring-2 focus-visible:ring-primary/40"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </div>

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

      <Dialog
        open={assembleProductState !== null}
        onClose={() => setAssembleProductState(null)}
        title="Assemble from raw materials"
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

      <Dialog open={pendingDelete !== null} onClose={() => setPendingDelete(null)} title="Delete product">
        <p className="text-sm text-text-muted">
          Are you sure you want to delete <span className="font-medium text-text">{pendingDelete?.name}</span>? This
          cannot be undone.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setPendingDelete(null)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => pendingDelete && deleteMutation.mutate(pendingDelete._id)}
            isLoading={deleteMutation.isPending}
          >
            Delete
          </Button>
        </div>
      </Dialog>

      <ProductQrModal
        productId={qrProduct?._id ?? null}
        productName={qrProduct?.name}
        onClose={() => setQrProduct(null)}
      />
    </>
  );
}
