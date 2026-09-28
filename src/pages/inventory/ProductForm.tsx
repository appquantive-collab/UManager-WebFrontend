import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { TextField } from "../../components/ui/TextField";
import { ApiError } from "../../lib/api";
import type { Product, ProductInput } from "../../lib/products-api";

const productSchema = z.object({
  name: z.string().min(1, "Name is required"),
  sku: z.string().min(1, "SKU is required"),
  category: z.string().optional(),
  brand: z.string().optional(),
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
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormInput, unknown, ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: initialValues
      ? {
          name: initialValues.name,
          sku: initialValues.sku,
          category: initialValues.category ?? "",
          brand: initialValues.brand ?? "",
          unit: initialValues.unit,
          purchasePrice: initialValues.purchasePrice,
          wholesalePrice: initialValues.wholesalePrice,
          retailPrice: initialValues.retailPrice,
          reorderLevel: initialValues.reorderLevel,
        }
      : { unit: "pcs", purchasePrice: 0, wholesalePrice: 0, retailPrice: 0, reorderLevel: 0 },
  });

  const submit = async (values: ProductFormValues) => {
    setFormError(null);
    try {
      await onSubmit(values);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    }
  };

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit(submit)} noValidate>
      <div className="grid grid-cols-2 gap-4">
        <TextField label="Product name" error={errors.name?.message} {...register("name")} />
        <TextField label="SKU" error={errors.sku?.message} {...register("sku")} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <TextField label="Category" error={errors.category?.message} {...register("category")} />
        <TextField label="Brand" error={errors.brand?.message} {...register("brand")} />
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
    </form>
  );
}
