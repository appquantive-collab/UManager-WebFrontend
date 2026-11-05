import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ScanLine, ImagePlus, Loader2, Plus, Trash2, X } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { TextField } from "../../components/ui/TextField";
import { PickOrCreateField } from "../../components/shared/PickOrCreateField";
import { BarcodeScannerModal } from "../../components/inventory/BarcodeScannerModal";
import { ApiError } from "../../lib/api";
import { showError } from "../../lib/toast";
import { listCategories, createCategory, listBrands, createBrand } from "../../lib/catalog-api";
import { listProducts, uploadProductImage, type BomLine, type Product, type ProductInput } from "../../lib/products-api";
import i18n from "../../lib/i18n";

const productSchema = z.object({
  name: z.string().min(1, { error: () => i18n.t("inventory.productForm.nameRequired") }),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  unit: z.string().min(1, { error: () => i18n.t("inventory.productForm.unitRequired") }),
  purchasePrice: z.coerce.number().min(0, { error: () => i18n.t("inventory.productForm.mustBeZeroOrMore") }),
  wholesalePrice: z.coerce.number().min(0, { error: () => i18n.t("inventory.productForm.mustBeZeroOrMore") }),
  retailPrice: z.coerce.number().min(0, { error: () => i18n.t("inventory.productForm.mustBeZeroOrMore") }),
  reorderLevel: z.coerce.number().min(0, { error: () => i18n.t("inventory.productForm.mustBeZeroOrMore") }),
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
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [category, setCategory] = useState<string | null>(initialValues?.category ?? null);
  const [brand, setBrand] = useState<string | null>(initialValues?.brand ?? null);
  const [imageUrl, setImageUrl] = useState<string | undefined>(initialValues?.imageUrl);
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
    mode: "onChange",
    reValidateMode: "onChange",
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
    onError: (err) => {
      showError(err instanceof ApiError ? err.message : t("inventory.productForm.couldNotCreateCategory"));
    },
  });
  const createBrandMutation = useMutation({
    mutationFn: createBrand,
    onSuccess: (b) => {
      queryClient.invalidateQueries({ queryKey: ["brands"] });
      setBrand(b.name);
    },
    onError: (err) => {
      showError(err instanceof ApiError ? err.message : t("inventory.productForm.couldNotCreateBrand"));
    },
  });

  const uploadImageMutation = useMutation({
    mutationFn: uploadProductImage,
    onSuccess: (result) => {
      setImageUrl(result.url);
    },
    onError: (err) => {
      showError(err instanceof ApiError ? err.message : t("inventory.productForm.couldNotUploadImage"));
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadImageMutation.mutate(file);
    e.target.value = "";
  };

  const validBomLines = bomLines.filter((line) => line.rawMaterialId && line.quantity > 0);

  const submit = async (values: ProductFormValues) => {
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
      showError(err instanceof ApiError ? err.message : t("inventory.productForm.genericError"));
    }
  };

  return (
    <form onSubmit={handleSubmit(submit)} noValidate>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <FormSection title={t("inventory.productForm.basics")}>
            <div className="flex items-start gap-4">
              {imageUrl ? (
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-border">
                  <img src={imageUrl} alt={t("inventory.productForm.productImageAlt")} className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setImageUrl(undefined)}
                    aria-label={t("inventory.productForm.removeImage")}
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
                  <span className="text-[9px]">{t("inventory.productForm.photo")}</span>
                </button>
              )}
              <div className="min-w-0 flex-1 space-y-1.5">
                <TextField label={t("inventory.productForm.productName")} error={errors.name?.message} {...register("name")} />
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
              <span className="text-sm font-medium text-text">{t("inventory.productForm.isRawMaterialLabel")}</span>
              <span className="text-xs text-text-muted">{t("inventory.productForm.isRawMaterialHint")}</span>
            </label>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-text-muted" htmlFor="sku-field">
                  {t("inventory.productForm.skuOptional")}
                </label>
                <div className="flex gap-2">
                  <input
                    id="sku-field"
                    placeholder={t("inventory.productForm.skuPlaceholder")}
                    className="w-full rounded-lg border border-transparent bg-surface-variant px-3.5 py-2.5 text-sm text-text outline-none focus:border-primary"
                    {...register("sku")}
                  />
                  <button
                    type="button"
                    onClick={() => setScannerOpen(true)}
                    aria-label={t("inventory.productForm.scanBarcodeToFillSku")}
                    className="flex shrink-0 items-center justify-center rounded-lg border border-border px-3 text-text-muted outline-none transition-colors hover:bg-surface-muted hover:text-text focus-visible:ring-2 focus-visible:ring-primary/40"
                  >
                    <ScanLine size={16} />
                  </button>
                </div>
                {errors.sku?.message ? <p className="mt-1 text-xs text-danger">{errors.sku.message}</p> : null}
              </div>
              <TextField label={t("inventory.productForm.unit")} error={errors.unit?.message} {...register("unit")} />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <PickOrCreateField
                label={t("inventory.productForm.categoryOptional")}
                options={(categoriesQuery.data ?? []).map((c) => ({ id: c.name, label: c.name }))}
                value={category}
                onChange={setCategory}
                onCreate={(name) => createCategoryMutation.mutate(name)}
                isCreating={createCategoryMutation.isPending}
                placeholder={t("inventory.productForm.noCategory")}
              />
              <PickOrCreateField
                label={t("inventory.productForm.brandOptional")}
                options={(brandsQuery.data ?? []).map((b) => ({ id: b.name, label: b.name }))}
                value={brand}
                onChange={setBrand}
                onCreate={(name) => createBrandMutation.mutate(name)}
                isCreating={createBrandMutation.isPending}
                placeholder={t("inventory.productForm.noBrand")}
              />
            </div>
          </FormSection>

          {!isRawMaterial && (
            <FormSection
              title={t("inventory.productForm.rawMaterialsUsed")}
              subtitle={t("inventory.productForm.rawMaterialsUsedSubtitle")}
              action={
                <button
                  type="button"
                  onClick={addBomLine}
                  className="flex items-center gap-1 text-xs font-semibold text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  <Plus size={13} /> {t("inventory.productForm.addMaterial")}
                </button>
              }
            >
              {bomLines.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border px-3.5 py-3 text-xs text-text-muted">
                  {t("inventory.productForm.noRawMaterialsConfigured")}
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
                        <option value="">{t("inventory.productForm.selectRawMaterial")}</option>
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
                        placeholder={t("inventory.productForm.unitPlaceholder")}
                        className="w-16 shrink-0 rounded-lg border border-transparent bg-surface-variant px-2.5 py-2 text-sm text-text outline-none focus:border-primary"
                      />
                      <button
                        type="button"
                        onClick={() => removeBomLine(line.key)}
                        aria-label={t("inventory.productForm.removeRawMaterial")}
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
                  {t("inventory.productForm.noRawMaterialsExist")}
                </p>
              ) : null}
            </FormSection>
          )}
        </div>

        <div className="space-y-6">
          <FormSection title={t("inventory.productForm.pricing")}>
            <TextField
              label={t("inventory.productForm.purchasePrice")}
              type="number"
              step="0.01"
              error={errors.purchasePrice?.message}
              {...register("purchasePrice")}
            />
            <TextField
              label={t("inventory.productForm.wholesalePrice")}
              type="number"
              step="0.01"
              error={errors.wholesalePrice?.message}
              {...register("wholesalePrice")}
            />
            <TextField
              label={t("inventory.productForm.retailPrice")}
              type="number"
              step="0.01"
              error={errors.retailPrice?.message}
              {...register("retailPrice")}
            />
          </FormSection>

          <FormSection title={t("inventory.productForm.stock")}>
            <TextField
              label={t("inventory.productForm.reorderLevel")}
              type="number"
              step="1"
              error={errors.reorderLevel?.message}
              {...register("reorderLevel")}
            />
          </FormSection>
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-3 border-t border-border pt-5">
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t("inventory.productForm.cancel")}
        </Button>
        <Button type="submit" isLoading={isSubmitting}>
          {initialValues ? t("inventory.productForm.saveChanges") : t("inventory.productForm.addProduct")}
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
