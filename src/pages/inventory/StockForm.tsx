import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { Minus, Plus } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { TextField } from "../../components/ui/TextField";
import { ApiError } from "../../lib/api";
import type { Product } from "../../lib/products-api";
import { getProductStockLevel, listWarehouses, type StockMovementType } from "../../lib/stock-api";

type Direction = "in" | "out";

const inTypes: { value: StockMovementType; label: string }[] = [
  { value: "purchase", label: "Purchase" },
  { value: "customer_return", label: "Customer return" },
  { value: "transfer_in", label: "Transfer in" },
  { value: "adjustment", label: "Adjustment (correction)" },
  { value: "opening", label: "Opening stock" },
];

const outTypes: { value: StockMovementType; label: string }[] = [
  { value: "sale", label: "Sale" },
  { value: "damage", label: "Damage / loss" },
  { value: "supplier_return", label: "Supplier return" },
  { value: "transfer_out", label: "Transfer out" },
  { value: "adjustment", label: "Adjustment (correction)" },
];

const stockFormSchema = z.object({
  warehouseId: z.string().min(1, "Select a warehouse"),
  movementType: z.string().min(1, "Select a reason"),
  quantity: z.coerce.number().int("Must be a whole number").positive("Must be greater than 0"),
  note: z.string().optional(),
});

type StockFormInput = z.input<typeof stockFormSchema>;
type StockFormValues = z.output<typeof stockFormSchema>;

interface StockFormProps {
  product: Product;
  onSubmit: (input: { warehouseId: string; movementType: StockMovementType; quantity: number; note?: string }) => Promise<unknown>;
  onCancel: () => void;
}

export function StockForm({ product, onSubmit, onCancel }: StockFormProps) {
  const [direction, setDirection] = useState<Direction>("in");
  const [formError, setFormError] = useState<string | null>(null);

  const { data: warehouses } = useQuery({ queryKey: ["warehouses"], queryFn: listWarehouses });
  const { data: stockLevel } = useQuery({
    queryKey: ["stock-level", product._id],
    queryFn: () => getProductStockLevel(product._id),
  });

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<StockFormInput, unknown, StockFormValues>({
    resolver: zodResolver(stockFormSchema),
    defaultValues: { movementType: "purchase", quantity: 1 },
  });

  const watchedWarehouseId = watch("warehouseId");
  const warehouseStock = watchedWarehouseId ? (stockLevel?.warehouses[watchedWarehouseId] ?? 0) : null;

  const types = direction === "in" ? inTypes : outTypes;

  const switchDirection = (next: Direction) => {
    setDirection(next);
    reset({ movementType: next === "in" ? "purchase" : "sale", quantity: 1, warehouseId: watchedWarehouseId });
  };

  const submit = async (values: StockFormValues) => {
    setFormError(null);
    try {
      const signedQuantity = direction === "in" ? values.quantity : -values.quantity;
      await onSubmit({
        warehouseId: values.warehouseId,
        movementType: values.movementType as StockMovementType,
        quantity: signedQuantity,
        note: values.note,
      });
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    }
  };

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit(submit)} noValidate>
      <div className="rounded-lg border border-border bg-surface-variant/50 px-3.5 py-2.5">
        <div className="text-sm font-medium text-text">{product.name}</div>
        <div className="text-xs text-text-muted">
          SKU: {product.sku}
          {stockLevel ? <> · Current stock (all warehouses): {stockLevel.total}</> : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 rounded-lg bg-surface-variant p-1">
        <button
          type="button"
          onClick={() => switchDirection("in")}
          className={clsx(
            "flex items-center justify-center gap-1.5 rounded-md py-2 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/40",
            direction === "in" ? "bg-success text-white" : "text-text-muted hover:text-text"
          )}
        >
          <Plus size={16} /> Add stock
        </button>
        <button
          type="button"
          onClick={() => switchDirection("out")}
          className={clsx(
            "flex items-center justify-center gap-1.5 rounded-md py-2 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/40",
            direction === "out" ? "bg-danger text-white" : "text-text-muted hover:text-text"
          )}
        >
          <Minus size={16} /> Remove / adjust down
        </button>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="warehouseId" className="text-sm font-medium text-text-muted">
          Warehouse
        </label>
        <select
          id="warehouseId"
          className={clsx(
            "rounded-lg border bg-surface-variant px-3.5 py-2.5 text-sm text-text outline-none transition-colors",
            errors.warehouseId ? "border-danger" : "border-transparent focus:border-primary"
          )}
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
        {watchedWarehouseId ? (
          <span className="text-xs text-text-muted">Current stock here: {warehouseStock}</span>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="movementType" className="text-sm font-medium text-text-muted">
          Reason
        </label>
        <select
          id="movementType"
          className={clsx(
            "rounded-lg border bg-surface-variant px-3.5 py-2.5 text-sm text-text outline-none transition-colors",
            errors.movementType ? "border-danger" : "border-transparent focus:border-primary"
          )}
          {...register("movementType")}
        >
          {types.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <TextField
        label={direction === "in" ? "Quantity to add" : "Quantity to remove"}
        type="number"
        min={1}
        step="1"
        error={errors.quantity?.message}
        {...register("quantity")}
      />

      <TextField label="Note (optional)" placeholder="e.g. GRN-882 delivery or damaged in transit" {...register("note")} />

      {formError ? <p className="text-sm text-danger">{formError}</p> : null}

      <div className="mt-2 flex justify-end gap-3">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" isLoading={isSubmitting}>
          {direction === "in" ? "Add stock" : "Remove stock"}
        </Button>
      </div>
    </form>
  );
}
