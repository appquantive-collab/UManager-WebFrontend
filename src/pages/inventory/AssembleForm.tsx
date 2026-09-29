import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { TextField } from "../../components/ui/TextField";
import { ApiError } from "../../lib/api";
import type { Product } from "../../lib/products-api";
import { listWarehouses } from "../../lib/stock-api";
import { getProducibleQuantity } from "../../lib/assembly-api";

const assembleFormSchema = z.object({
  warehouseId: z.string().min(1, "Select a warehouse"),
  quantity: z.coerce.number().int("Must be a whole number").positive("Must be greater than 0"),
  note: z.string().optional(),
});

type AssembleFormInput = z.input<typeof assembleFormSchema>;
type AssembleFormValues = z.output<typeof assembleFormSchema>;

interface AssembleFormProps {
  product: Product;
  onSubmit: (input: { warehouseId: string; quantity: number; note?: string }) => Promise<unknown>;
  onCancel: () => void;
}

export function AssembleForm({ product, onSubmit, onCancel }: AssembleFormProps) {
  const [formError, setFormError] = useState<string | null>(null);

  const { data: warehouses } = useQuery({ queryKey: ["warehouses"], queryFn: listWarehouses });
  const { data: producible } = useQuery({
    queryKey: ["producible", product._id],
    queryFn: () => getProducibleQuantity(product._id),
  });

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<AssembleFormInput, unknown, AssembleFormValues>({
    resolver: zodResolver(assembleFormSchema),
    defaultValues: { quantity: 1 },
  });

  const watchedQuantity = Number(watch("quantity")) || 0;
  const exceedsProducible = producible ? watchedQuantity > producible.producibleQuantity : false;

  const submit = async (values: AssembleFormValues) => {
    setFormError(null);
    try {
      await onSubmit(values);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    }
  };

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit(submit)} noValidate>
      <div className="rounded-lg border border-border bg-surface-variant/50 px-3.5 py-2.5">
        <div className="text-sm font-medium text-text">{product.name}</div>
        <div className="text-xs text-text-muted">SKU: {product.sku}</div>
      </div>

      {producible ? (
        <div className="rounded-lg border border-border p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
            Can currently make {producible.producibleQuantity === Infinity ? "unlimited" : producible.producibleQuantity} more
          </p>
          <div className="space-y-1.5">
            {producible.rawMaterials.map((rm) => (
              <div key={rm.rawMaterialId} className="flex items-center justify-between text-xs">
                <span className="text-text-muted">
                  {rm.rawMaterialName} ({rm.requiredPerUnit} {rm.unit}/unit)
                </span>
                <span className="text-text">
                  {rm.currentStock} {rm.unit} in stock
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="assemble-warehouseId" className="text-sm font-medium text-text-muted">
          Warehouse
        </label>
        <select
          id="assemble-warehouseId"
          className="rounded-lg border border-transparent bg-surface-variant px-3.5 py-2.5 text-sm text-text outline-none focus:border-primary"
          {...register("warehouseId")}
        >
          <option value="">Select warehouse…</option>
          {warehouses?.map((w) => (
            <option key={w._id} value={w._id}>
              {w.name}
            </option>
          ))}
        </select>
        {errors.warehouseId ? <span className="text-xs text-danger">{errors.warehouseId.message}</span> : null}
      </div>

      <TextField
        label="Quantity to assemble"
        type="number"
        min={1}
        step="1"
        error={errors.quantity?.message}
        {...register("quantity")}
      />

      {exceedsProducible ? (
        <p className="flex items-start gap-1.5 rounded-lg bg-warning-container/40 px-3 py-2 text-xs text-warning">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          Not enough raw material stock for {watchedQuantity} units — assembling anyway will take one or more raw
          materials negative.
        </p>
      ) : null}

      <TextField label="Note (optional)" placeholder="e.g. Batch #12 assembly" {...register("note")} />

      {formError ? <p className="text-sm text-danger">{formError}</p> : null}

      <div className="mt-2 flex justify-end gap-3">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" isLoading={isSubmitting}>
          Assemble
        </Button>
      </div>
    </form>
  );
}
