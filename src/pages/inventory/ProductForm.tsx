import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ScanLine, ImagePlus, Loader2, Plus, Trash2, X } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { TextField } from "../../components/ui/TextField";
import { PickOrCreateField } from "../../components/shared/PickOrCreateField";
import { BarcodeScannerModal } from "../../components/inventory/BarcodeScannerModal";
import { ApiError } from "../../lib/api";
import { listCategories, createCategory, listBrands, createBrand } from "../../lib/catalog-api";
import { listProducts, uploadProductImage, type BomLine, type Product, type ProductInput } from "../../lib/products-api";

const productSchema = z.object({
  name: z.string().min(1, "Name is required"),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  unit: z.string().min(1, "Unit is required"),
  purchasePrice: z.coerce.number().min(0, "Must be 0 or more"),
  wholesalePrice: z.coerce.number().min(0, "Must be 0 or more"),
  retailPrice: z.coerce.number().min(0, "Must be 0 or more"),
  reorderLevel: z.coerce.number().min(0, "Must be 0 or more"),
});

type ProductFormInput = z.input<typeof productSchema>;
type ProductFormValues = z.output<typeof productSchema>;

interface ProductFormProps {
  initialValues?: Product;
  defaultIsRawMaterial?: boolean;
  onSubmit: (input: ProductInput) => Promise<unknown>;
  onCancel: () => void;
}

let bomRowSeq = 0;
function nextBomRowKey() {
  bomRowSeq += 1;
  return `bom-${bomRowSeq}`;
}

interface DraftBomLine extends BomLine {
  key: string;
}

export function ProductForm({ initialValues, defaultIsRawMaterial, onSubmit, onCancel }: ProductFormProps) {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(initialValues?.category ?? null);
  const [brand, setBrand] = useState<string | null>(initialValues?.brand ?? null);
  const [imageUrl, setImageUrl] = useState<string | undefined>(initialValues?.imageUrl);
  const [imageError, setImageError] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [isRawMaterial, setIsRawMaterial] = useState(initialValues?.isRawMaterial ?? defaultIsRawMaterial ?? false);
  const [bomLines, setBomLines] = useState<DraftBomLine[]>(
    (initialValues?.bom ?? []).map((line) => ({ ...line, key: nextBomRowKey() }))
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const rawMaterialsQuery = useQuery({
    queryKey: ["products", "rawMaterial", true],
    queryFn: () => listProducts({ rawMaterial: true }),
    enabled: !isRawMaterial,
  });

  const addBomLine = () => {
    setBomLines((current) => [...current, { key: nextBomRowKey(), rawMaterialId: "", quantity: 1, unit: "pcs" }]);
  };
  const updateBomLine = (key: string, patch: Partial<DraftBomLine>) => {
    setBomLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  };
  const removeBomLine = (key: string) => {
    setBomLines((current) => current.filter((line) => line.key !== key));
  };

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormInput, unknown, ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: initialValues
      ? {
          name: initialValues.name,
          sku: initialValues.sku,
          barcode: initialValues.barcode ?? "",
          unit: initialValues.unit,
          purchasePrice: initialValues.purchasePrice,
          wholesalePrice: initialValues.wholesalePrice,
          retailPrice: initialValues.retailPrice,
          reorderLevel: initialValues.reorderLevel,
        }
      : { unit: "pcs", purchasePrice: 0, wholesalePrice: 0, retailPrice: 0, reorderLevel: 0 },
  });

  const categoriesQuery = useQuery({ queryKey: ["categories"], queryFn: listCategories });
  const brandsQuery = useQuery({ queryKey: ["brands"], queryFn: listBrands });

  const createCategoryMutation = useMutation({
    mutationFn: createCategory,
    onSuccess: (c) => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setCategory(c.name);
    },
  });
  const createBrandMutation = useMutation({
    mutationFn: createBrand,
    onSuccess: (b) => {
      queryClient.invalidateQueries({ queryKey: ["brands"] });
      setBrand(b.name);
    },
  });

  const uploadImageMutation = useMutation({
    mutationFn: uploadProductImage,
    onSuccess: (result) => {
      setImageUrl(result.url);
      setImageError(null);
    },
    onError: (err) => {
      setImageError(err instanceof ApiError ? err.message : "Could not upload image. Please try again.");
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadImageMutation.mutate(file);
    e.target.value = "";
  };

  const validBomLines = bomLines.filter((line) => line.rawMaterialId && line.quantity > 0);

  const submit = async (values: ProductFormValues) => {
    setFormError(null);
    try {
      await onSubmit({
        ...values,
        category: category ?? undefined,
        brand: brand ?? undefined,
        imageUrl,
        isRawMaterial,
        bom: isRawMaterial
          ? []
          : validBomLines.map((line) => ({ rawMaterialId: line.rawMaterialId, quantity: line.quantity, unit: line.unit })),
      });
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    }
  };

  return (
    <form onSubmit={handleSubmit(submit)} noValidate>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <FormSection title="Basics">
            <div className="flex items-start gap-4">
              {imageUrl ? (
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-border">
                  <img src={imageUrl} alt="Product" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setImageUrl(undefined)}
                    aria-label="Remove image"
                    className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white outline-none"
                  >
                    <X size={11} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadImageMutation.isPending}
                  className="flex h-16 w-16 shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed border-border text-text-muted outline-none transition-colors hover:border-primary/40 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50"
                >
                  {uploadImageMutation.isPending ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <ImagePlus size={16} />
                  )}
                  <span className="text-[9px]">Photo</span>
                </button>
              )}
              <div className="min-w-0 flex-1 space-y-1.5">
                <TextField label="Product name" error={errors.name?.message} {...register("name")} />
                {imageError ? <p className="text-xs text-danger">{imageError}</p> : null}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
            </div>

            <label className="flex items-center gap-2.5 rounded-lg border border-border bg-surface-variant px-3.5 py-2.5">
              <input
                type="checkbox"
                checked={isRawMaterial}
                onChange={(e) => setIsRawMaterial(e.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              <span className="text-sm font-medium text-text">This is a raw material</span>
              <span className="text-xs text-text-muted">(used to build other products, not sold directly)</span>
            </label>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-text-muted" htmlFor="sku-field">
                  SKU (optional)
                </label>
                <div className="flex gap-2">
                  <input
                    id="sku-field"
                    placeholder="Auto-generated if left blank"
                    className="w-full rounded-lg border border-transparent bg-surface-variant px-3.5 py-2.5 text-sm text-text outline-none focus:border-primary"
                    {...register("sku")}
                  />
                  <button
                    type="button"
                    onClick={() => setScannerOpen(true)}
                    aria-label="Scan barcode to fill SKU"
                    className="flex shrink-0 items-center justify-center rounded-lg border border-border px-3 text-text-muted outline-none transition-colors hover:bg-surface-muted hover:text-text focus-visible:ring-2 focus-visible:ring-primary/40"
                  >
                    <ScanLine size={16} />
                  </button>
                </div>
                {errors.sku?.message ? <p className="mt-1 text-xs text-danger">{errors.sku.message}</p> : null}
              </div>
              <TextField label="Unit" error={errors.unit?.message} {...register("unit")} />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <PickOrCreateField
                label="Category (optional)"
                options={(categoriesQuery.data ?? []).map((c) => ({ id: c.name, label: c.name }))}
                value={category}
                onChange={setCategory}
                onCreate={(name) => createCategoryMutation.mutate(name)}
                isCreating={createCategoryMutation.isPending}
                placeholder="No category"
              />
              <PickOrCreateField
                label="Brand (optional)"
                options={(brandsQuery.data ?? []).map((b) => ({ id: b.name, label: b.name }))}
                value={brand}
                onChange={setBrand}
                onCreate={(name) => createBrandMutation.mutate(name)}
                isCreating={createBrandMutation.isPending}
                placeholder="No brand"
              />
            </div>
          </FormSection>

          {!isRawMaterial && (
            <FormSection
              title="Raw materials used"
              subtitle="Optional — leave empty if this product's stock is tracked directly."
              action={
                <button
                  type="button"
                  onClick={addBomLine}
                  className="flex items-center gap-1 text-xs font-semibold text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  <Plus size={13} /> Add material
                </button>
              }
            >
              {bomLines.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border px-3.5 py-3 text-xs text-text-muted">
                  No raw materials configured.
                </p>
              ) : (
                <div className="space-y-2">
                  {bomLines.map((line) => (
                    <div key={line.key} className="flex items-center gap-2">
                      <select
                        value={line.rawMaterialId}
                        onChange={(e) => updateBomLine(line.key, { rawMaterialId: e.target.value })}
                        className="min-w-0 flex-1 rounded-lg border border-transparent bg-surface-variant px-3 py-2 text-sm text-text outline-none focus:border-primary"
                      >
                        <option value="">Select raw material…</option>
                        {(rawMaterialsQuery.data ?? []).map((rm) => (
                          <option key={rm._id} value={rm._id}>
                            {rm.name}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min={0.001}
                        step="any"
                        value={line.quantity}
                        onChange={(e) => updateBomLine(line.key, { quantity: Number(e.target.value) })}
                        className="w-20 shrink-0 rounded-lg border border-transparent bg-surface-variant px-2.5 py-2 text-sm text-text outline-none focus:border-primary"
                      />
                      <input
                        value={line.unit}
                        onChange={(e) => updateBomLine(line.key, { unit: e.target.value })}
                        placeholder="unit"
                        className="w-16 shrink-0 rounded-lg border border-transparent bg-surface-variant px-2.5 py-2 text-sm text-text outline-none focus:border-primary"
                      />
                      <button
                        type="button"
                        onClick={() => removeBomLine(line.key)}
                        aria-label="Remove raw material"
                        className="shrink-0 rounded-md p-1.5 text-text-muted outline-none transition-colors hover:bg-surface-muted hover:text-danger focus-visible:ring-2 focus-visible:ring-primary/40"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {rawMaterialsQuery.data?.length === 0 && bomLines.length === 0 ? (
                <p className="text-xs text-text-muted">
                  No raw materials exist yet — add one from the Raw Materials tab first.
                </p>
              ) : null}
            </FormSection>
          )}
        </div>

        <div className="space-y-6">
          <FormSection title="Pricing">
            <TextField
              label="Purchase price"
              type="number"
              step="0.01"
              error={errors.purchasePrice?.message}
              {...register("purchasePrice")}
            />
            <TextField
              label="Wholesale price"
              type="number"
              step="0.01"
              error={errors.wholesalePrice?.message}
              {...register("wholesalePrice")}
            />
            <TextField
              label="Retail price"
              type="number"
              step="0.01"
              error={errors.retailPrice?.message}
              {...register("retailPrice")}
            />
          </FormSection>

          <FormSection title="Stock">
            <TextField
              label="Reorder level"
              type="number"
              step="1"
              error={errors.reorderLevel?.message}
              {...register("reorderLevel")}
            />
          </FormSection>
        </div>
      </div>

      {formError ? <p className="mt-4 text-sm text-danger">{formError}</p> : null}

      <div className="mt-6 flex justify-end gap-3 border-t border-border pt-5">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" isLoading={isSubmitting}>
          {initialValues ? "Save changes" : "Add product"}
        </Button>
      </div>

      <BarcodeScannerModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={(value) => {
          setValue("sku", value);
          setScannerOpen(false);
        }}
      />
    </form>
  );
}

function FormSection({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-text">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-xs text-text-muted">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}
