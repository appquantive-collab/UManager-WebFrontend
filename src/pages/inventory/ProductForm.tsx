import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ScanLine, ImagePlus, Loader2, X } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { TextField } from "../../components/ui/TextField";
import { PickOrCreateField } from "../../components/shared/PickOrCreateField";
import { BarcodeScannerModal } from "../../components/inventory/BarcodeScannerModal";
import { ApiError } from "../../lib/api";
import { listCategories, createCategory, listBrands, createBrand } from "../../lib/catalog-api";
import { uploadProductImage, type Product, type ProductInput } from "../../lib/products-api";

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
  onSubmit: (input: ProductInput) => Promise<unknown>;
  onCancel: () => void;
}

export function ProductForm({ initialValues, onSubmit, onCancel }: ProductFormProps) {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(initialValues?.category ?? null);
  const [brand, setBrand] = useState<string | null>(initialValues?.brand ?? null);
  const [imageUrl, setImageUrl] = useState<string | undefined>(initialValues?.imageUrl);
  const [imageError, setImageError] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const submit = async (values: ProductFormValues) => {
    setFormError(null);
    try {
      await onSubmit({
        ...values,
        category: category ?? undefined,
        brand: brand ?? undefined,
        imageUrl,
      });
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    }
  };

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit(submit)} noValidate>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-text-muted">Product image (optional)</label>
        <div className="flex items-center gap-3">
          {imageUrl ? (
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-border">
              <img src={imageUrl} alt="Product" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => setImageUrl(undefined)}
                aria-label="Remove image"
                className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white outline-none"
              >
                <X size={12} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadImageMutation.isPending}
              className="flex h-20 w-20 shrink-0 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border text-text-muted outline-none transition-colors hover:border-primary/40 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50"
            >
              {uploadImageMutation.isPending ? <Loader2 size={18} className="animate-spin" /> : <ImagePlus size={18} />}
              <span className="text-[10px]">Upload</span>
            </button>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
          <p className="text-xs text-text-muted">JPG or PNG, up to 5MB.</p>
        </div>
        {imageError ? <p className="mt-1.5 text-xs text-danger">{imageError}</p> : null}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <TextField label="Product name" error={errors.name?.message} {...register("name")} />
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
      </div>

      <div className="grid grid-cols-2 gap-4">
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

      <div className="grid grid-cols-2 gap-4">
        <TextField label="Unit" error={errors.unit?.message} {...register("unit")} />
        <TextField
          label="Reorder level"
          type="number"
          step="1"
          error={errors.reorderLevel?.message}
          {...register("reorderLevel")}
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
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
      </div>

      {formError ? <p className="text-sm text-danger">{formError}</p> : null}

      <div className="mt-2 flex justify-end gap-3">
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
