import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Boxes, Package, Plus, QrCode, SquarePen, Trash2 } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Dialog } from "../../components/ui/Dialog";
import { EmptyState } from "../../components/ui/EmptyState";
import { IconChip } from "../../components/ui/IconChip";
import { SearchInput } from "../../components/ui/SearchInput";
import {
  createProduct,
  deleteProduct,
  listProducts,
  updateProduct,
  type Product,
  type ProductInput,
} from "../../lib/products-api";
import { createStockMovement, getStockLevels, type CreateMovementInput } from "../../lib/stock-api";
import { MobileInventoryStock } from "./MobileInventoryStock";
import { ProductForm } from "./ProductForm";
import { StockForm } from "./StockForm";
import { ProductQrModal } from "../../components/inventory/ProductQrModal";

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
  const [search, setSearch] = useState("");
  const [dialogState, setDialogState] = useState<{ mode: "create" } | { mode: "edit"; product: Product } | null>(
    null
  );
  const [pendingDelete, setPendingDelete] = useState<Product | null>(null);
  const [stockProduct, setStockProduct] = useState<Product | null>(null);
  const [qrProduct, setQrProduct] = useState<Product | null>(null);

  const { data: products, isLoading, isError } = useQuery({
    queryKey: ["products"],
    queryFn: listProducts,
  });

  const { data: stockLevels } = useQuery({
    queryKey: ["stock-levels"],
    queryFn: getStockLevels,
  });

  const createMutation = useMutation({
    mutationFn: (input: ProductInput) => createProduct(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setDialogState(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<ProductInput> }) => updateProduct(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setDialogState(null);
    },
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

  const filtered = useMemo(() => {
    if (!products) return [];
    const query = search.trim().toLowerCase();
    if (!query) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.sku.toLowerCase().includes(query) ||
        p.category?.toLowerCase().includes(query)
    );
  }, [products, search]);

  return (
    <>
      <div className="lg:hidden">
        <MobileInventoryStock />
      </div>

      <div className="hidden space-y-6 lg:block">
      <div className="flex justify-end">
        <Button onClick={() => setDialogState({ mode: "create" })}>
          <Plus size={16} className="mr-1.5" strokeWidth={2} />
          Add product
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
          title={products && products.length > 0 ? "No matching products" : "No products yet"}
          description={
            products && products.length > 0
              ? "Try a different search term."
              : "Add your first product to start tracking inventory, pricing, and stock."
          }
          action={
            !products || products.length === 0 ? (
              <Button onClick={() => setDialogState({ mode: "create" })}>Add product</Button>
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
                        onClick={() => setDialogState({ mode: "edit", product })}
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

      <Dialog
        open={dialogState !== null}
        onClose={() => setDialogState(null)}
        title={dialogState?.mode === "edit" ? "Edit product" : "Add product"}
      >
        <ProductForm
          key={dialogState?.mode === "edit" ? dialogState.product._id : "create"}
          initialValues={dialogState?.mode === "edit" ? dialogState.product : undefined}
          onCancel={() => setDialogState(null)}
          onSubmit={(input) =>
            dialogState?.mode === "edit"
              ? updateMutation.mutateAsync({ id: dialogState.product._id, input })
              : createMutation.mutateAsync(input)
          }
        />
      </Dialog>

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
