import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import { Minus, Plus } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { TextField } from "../../components/ui/TextField";
import { ApiError } from "../../lib/api";
import { showError } from "../../lib/toast";
import type { Product } from "../../lib/products-api";
import { getProductStockLevel, listWarehouses, type StockMovementType } from "../../lib/stock-api";
import i18n from "../../lib/i18n";

type Direction = "in" | "out";

const inTypes: { value: StockMovementType; label: string }[] = [
  { value: "purchase", label: "inventory.stockForm.typePurchase" },
  { value: "customer_return", label: "inventory.stockForm.typeCustomerReturn" },
  { value: "transfer_in", label: "inventory.stockForm.typeTransferIn" },
  { value: "adjustment", label: "inventory.stockForm.typeAdjustment" },
  { value: "opening", label: "inventory.stockForm.typeOpening" },
];

const outTypes: { value: StockMovementType; label: string }[] = [
  { value: "sale", label: "inventory.stockForm.typeSale" },
  { value: "damage", label: "inventory.stockForm.typeDamage" },
  { value: "supplier_return", label: "inventory.stockForm.typeSupplierReturn" },
  { value: "transfer_out", label: "inventory.stockForm.typeTransferOut" },
  { value: "adjustment", label: "inventory.stockForm.typeAdjustment" },
];

const stockFormSchema = z.object({
  warehouseId: z.string().min(1, { error: () => i18n.t("inventory.stockForm.selectWarehouse") }),
  movementType: z.string().min(1, { error: () => i18n.t("inventory.stockForm.selectReason") }),
  quantity: z.coerce
    .number()
    .int({ error: () => i18n.t("inventory.stockForm.mustBeWholeNumber") })
    .positive({ error: () => i18n.t("inventory.stockForm.mustBeGreaterThanZero") }),
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
  const { t } = useTranslation();
  const [direction, setDirection] = useState<Direction>("in");

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
    mode: "onChange",
    reValidateMode: "onChange",
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
    try {
      const signedQuantity = direction === "in" ? values.quantity : -values.quantity;
      await onSubmit({
        warehouseId: values.warehouseId,
        movementType: values.movementType as StockMovementType,
        quantity: signedQuantity,
        note: values.note,
      });
    } catch (err) {
      showError(err instanceof ApiError ? err.message : t("inventory.stockForm.genericError"));
    }
  };

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit(submit)} noValidate>
      <div className="rounded-lg border border-border bg-surface-variant/50 px-3.5 py-2.5">
        <div className="text-sm font-medium text-text">{product.name}</div>
        <div className="text-xs text-text-muted">
          {t("inventory.qrModal.skuLabel", { sku: product.sku })}
          {stockLevel ? (
            <> · {t("inventory.stockForm.currentStockAllWarehouses", { total: stockLevel.total })}</>
          ) : null}
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
          <Plus size={16} /> {t("inventory.stockForm.addStock")}
        </button>
        <button
          type="button"
          onClick={() => switchDirection("out")}
          className={clsx(
            "flex items-center justify-center gap-1.5 rounded-md py-2 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/40",
            direction === "out" ? "bg-danger text-white" : "text-text-muted hover:text-text"
          )}
        >
          <Minus size={16} /> {t("inventory.stockForm.removeOrAdjustDown")}
        </button>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="warehouseId" className="text-sm font-semibold text-text">
          {t("inventory.stockForm.warehouse")}
        </label>
        <select
          id="warehouseId"
          className={clsx(
            "rounded-lg border bg-surface-variant px-3.5 py-2.5 text-sm text-text outline-none transition-colors",
            errors.warehouseId ? "border-danger" : "border-transparent focus:border-primary"
          )}
          {...register("warehouseId")}
        >
          <option value="">{t("inventory.stockForm.selectWarehousePlaceholder")}</option>
          {warehouses?.map((w) => (
            <option key={w._id} value={w._id}>
              {w.name}
            </option>
          ))}
        </select>
        {errors.warehouseId ? <span className="text-xs text-danger">{errors.warehouseId.message}</span> : null}
        {watchedWarehouseId ? (
          <span className="text-xs text-text-muted">
            {t("inventory.stockForm.currentStockHere", { quantity: warehouseStock })}
          </span>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="movementType" className="text-sm font-semibold text-text">
          {t("inventory.stockForm.reason")}
        </label>
        <select
          id="movementType"
          className={clsx(
            "rounded-lg border bg-surface-variant px-3.5 py-2.5 text-sm text-text outline-none transition-colors",
            errors.movementType ? "border-danger" : "border-transparent focus:border-primary"
          )}
          {...register("movementType")}
        >
          {types.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {t(opt.label)}
            </option>
          ))}
        </select>
      </div>

      <TextField
        label={direction === "in" ? t("inventory.stockForm.quantityToAdd") : t("inventory.stockForm.quantityToRemove")}
        type="number"
        min={1}
        step="1"
        error={errors.quantity?.message}
        {...register("quantity")}
      />

      <TextField
        label={t("inventory.stockForm.noteOptional")}
        placeholder={t("inventory.stockForm.notePlaceholder")}
        {...register("note")}
      />

      <div className="mt-2 flex justify-end gap-3">
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t("inventory.stockForm.cancel")}
        </Button>
        <Button type="submit" isLoading={isSubmitting}>
          {direction === "in" ? t("inventory.stockForm.addStock") : t("inventory.stockForm.removeStock")}
        </Button>
      </div>
    </form>
  );
}
