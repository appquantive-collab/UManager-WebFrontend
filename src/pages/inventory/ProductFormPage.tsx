import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { createProduct, getProduct, updateProduct, type ProductInput } from "../../lib/products-api";
import { ProductForm } from "./ProductForm";

export function ProductFormPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = Boolean(id);
  const defaultIsRawMaterial = searchParams.get("type") === "raw-material";

  const productQuery = useQuery({
    queryKey: ["product", id],
    queryFn: () => getProduct(id!),
    enabled: isEdit,
  });

  const createMutation = useMutation({
    mutationFn: (input: ProductInput) => createProduct(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      navigate("/app/inventory");
    },
  });

  const updateMutation = useMutation({
    mutationFn: (input: Partial<ProductInput>) => updateProduct(id!, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      navigate("/app/inventory");
    },
  });

  const goBack = () => navigate("/app/inventory");

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-10">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={goBack}
          aria-label="Back to inventory"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-text-muted outline-none transition-colors hover:bg-surface-muted hover:text-text focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 className="text-lg font-bold text-text">{isEdit ? "Edit product" : "Add product"}</h1>
          <p className="text-xs text-text-muted">
            {isEdit ? "Update product or raw material details." : "Create a new product or raw material."}
          </p>
        </div>
      </div>

      {isEdit && productQuery.isLoading ? (
        <div className="rounded-2xl border border-border bg-surface p-6 text-sm text-text-muted">
          Loading product…
        </div>
      ) : isEdit && !productQuery.data ? (
        <div className="rounded-2xl border border-border bg-surface p-6 text-sm text-danger">
          Could not load this product.
        </div>
      ) : (
        <ProductForm
          initialValues={productQuery.data}
          defaultIsRawMaterial={defaultIsRawMaterial}
          onCancel={goBack}
          onSubmit={(input) => (isEdit ? updateMutation.mutateAsync(input) : createMutation.mutateAsync(input))}
        />
      )}
    </div>
  );
}
