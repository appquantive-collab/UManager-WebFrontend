import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { AlertTriangle, Ban, CheckCircle2, Phone, Plus, Trash2, X } from "lucide-react";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { formatCurrency } from "../../lib/format";
import {
  updateOrder,
  updateOrderStatus,
  type Order,
  type OrderLineItemInput,
} from "../../lib/orders-api";
import { ApiError } from "../../lib/api";

interface DraftItem extends OrderLineItemInput {
  key: string;
}

let keySeq = 0;
function nextKey() {
  keySeq += 1;
  return `order-item-${keySeq}`;
}

function customerName(order: Order): string {
  return typeof order.customerId === "string" ? "Unknown customer" : order.customerId.name;
}

function customerPhone(order: Order): string | undefined {
  return typeof order.customerId === "string" ? undefined : order.customerId.phone;
}

const statusTone = {
  pending: "warning",
  confirmed: "info",
  delivered: "success",
  cancelled: "danger",
} as const;

const statusLabel: Record<Order["status"], string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  delivered: "Billed",
  cancelled: "Cancelled",
};

export function OrderDetailModal({ order, onClose }: { order: Order | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [items, setItems] = useState<DraftItem[]>([]);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (order) {
      setItems(
        order.items.map((i) => ({
          key: nextKey(),
          productId: i.productId,
          productName: i.productName,
          quantity: i.quantity,
          unit: i.unit,
          unitPrice: i.unitPrice,
          isNewProduct: false,
        }))
      );
      setNotes(order.notes ?? "");
      setError(null);
    }
  }, [order]);

  const saveMutation = useMutation({
    mutationFn: (input: { items: OrderLineItemInput[]; notes?: string }) => updateOrder(order!._id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      onClose();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Couldn't save changes. Please try again."),
  });

  const statusMutation = useMutation({
    mutationFn: (status: "pending" | "confirmed" | "cancelled") => updateOrderStatus(order!._id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      onClose();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Couldn't update status. Please try again."),
  });

  if (!order) return null;

  const editable = order.status === "pending" || order.status === "confirmed";

  const updateItem = (key: string, patch: Partial<DraftItem>) => {
    setItems((current) => current.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  };
  const removeItem = (key: string) => {
    setItems((current) => current.filter((it) => it.key !== key));
  };
  const addBlankItem = () => {
    setItems((current) => [
      ...current,
      { key: nextKey(), productName: "", quantity: 1, unit: "pcs", unitPrice: 0, isNewProduct: true },
    ]);
  };

  const totalAmount = items.reduce((sum, i) => sum + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0), 0);
  const canSave = items.length > 0 && items.every((i) => i.productName.trim() && i.quantity > 0);

  const handleSave = () => {
    setError(null);
    saveMutation.mutate({
      items: items.map((i) => ({
        productId: i.productId,
        productName: i.productName.trim(),
        quantity: Number(i.quantity),
        unit: i.unit || "pcs",
        unitPrice: Number(i.unitPrice) || 0,
        isNewProduct: i.isNewProduct,
      })),
      notes: notes.trim() || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/40 p-4">
      <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl bg-surface shadow-elevation-3">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 z-10 rounded-full p-1.5 text-text-muted outline-none transition-colors hover:bg-surface-muted hover:text-text focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <X size={18} />
        </button>

        <div className="overflow-y-auto p-6">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-text">{customerName(order)}</h2>
            <Badge tone={statusTone[order.status]}>{statusLabel[order.status]}</Badge>
          </div>
          {customerPhone(order) ? (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-text-muted">
              <Phone size={13} />
              {customerPhone(order)}
            </p>
          ) : null}

          {!editable ? (
            <p className="mt-3 rounded-lg bg-surface-variant px-3.5 py-2.5 text-sm text-text-muted">
              This order is {order.status} and can no longer be edited.
            </p>
          ) : null}

          <div className="mt-5">
            <p className="mb-2 text-sm font-medium text-text-muted">Items ({items.length})</p>
            <div className="space-y-2.5">
              {items.map((item) => (
                <div
                  key={item.key}
                  className={clsx(
                    "rounded-xl border p-3",
                    item.isNewProduct ? "border-warning/50 bg-warning-container/20" : "border-border bg-surface"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    {item.isNewProduct ? (
                      <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-warning">
                        <AlertTriangle size={12} /> New product
                      </span>
                    ) : (
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Item</span>
                    )}
                    {editable ? (
                      <button
                        type="button"
                        onClick={() => removeItem(item.key)}
                        aria-label="Remove item"
                        className="rounded-full p-1 text-text-muted outline-none transition-colors hover:bg-surface-muted hover:text-danger focus-visible:ring-2 focus-visible:ring-primary/40"
                      >
                        <Trash2 size={14} />
                      </button>
                    ) : null}
                  </div>

                  <input
                    value={item.productName}
                    onChange={(e) => updateItem(item.key, { productName: e.target.value })}
                    placeholder="Product name"
                    disabled={!editable}
                    className="mt-2 w-full rounded-lg border border-transparent bg-surface-variant px-3 py-2 text-sm text-text outline-none focus:border-primary disabled:opacity-60"
                  />

                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-xs text-text-muted">Qty</label>
                      <input
                        type="number"
                        min={0.001}
                        step="any"
                        value={item.quantity}
                        disabled={!editable}
                        onChange={(e) => updateItem(item.key, { quantity: Number(e.target.value) })}
                        className="mt-0.5 w-full rounded-lg border border-transparent bg-surface-variant px-2.5 py-1.5 text-sm text-text outline-none focus:border-primary disabled:opacity-60"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-text-muted">Unit</label>
                      <input
                        value={item.unit}
                        disabled={!editable}
                        onChange={(e) => updateItem(item.key, { unit: e.target.value })}
                        className="mt-0.5 w-full rounded-lg border border-transparent bg-surface-variant px-2.5 py-1.5 text-sm text-text outline-none focus:border-primary disabled:opacity-60"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-text-muted">Price</label>
                      <input
                        type="number"
                        min={0}
                        step="any"
                        value={item.unitPrice}
                        disabled={!editable}
                        onChange={(e) => updateItem(item.key, { unitPrice: Number(e.target.value) })}
                        className="mt-0.5 w-full rounded-lg border border-transparent bg-surface-variant px-2.5 py-1.5 text-sm text-text outline-none focus:border-primary disabled:opacity-60"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {editable ? (
              <button
                type="button"
                onClick={addBlankItem}
                className="mt-2.5 flex items-center gap-1.5 text-sm font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <Plus size={14} /> Add item
              </button>
            ) : null}
          </div>

          <div className="mt-5">
            <label className="mb-1.5 block text-sm font-medium text-text-muted" htmlFor="order-notes">
              Notes
            </label>
            <textarea
              id="order-notes"
              value={notes}
              disabled={!editable}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              maxLength={1000}
              placeholder="Optional notes about this order…"
              className="w-full resize-none rounded-lg border border-transparent bg-surface-variant px-3.5 py-2.5 text-sm text-text outline-none transition-colors placeholder:text-text-muted/70 focus:border-primary disabled:opacity-60"
            />
          </div>

          <div className="mt-5 flex items-center justify-between rounded-lg bg-surface-variant px-3.5 py-2.5">
            <span className="text-sm font-medium text-text-muted">Total</span>
            <span className="text-base font-bold text-text">{formatCurrency(totalAmount)}</span>
          </div>

          {error ? (
            <p className="mt-3 flex items-center gap-1.5 text-sm text-danger">
              <AlertTriangle size={14} /> {error}
            </p>
          ) : null}

          {editable ? (
            <>
              <div className="mt-5 flex gap-3">
                {order.status === "pending" ? (
                  <Button
                    variant="secondary"
                    className="flex-1"
                    isLoading={statusMutation.isPending}
                    onClick={() => statusMutation.mutate("confirmed")}
                  >
                    <CheckCircle2 size={16} className="mr-1.5" strokeWidth={2} />
                    Confirm
                  </Button>
                ) : null}
                <Button
                  variant="danger"
                  className="flex-1"
                  isLoading={statusMutation.isPending}
                  onClick={() => statusMutation.mutate("cancelled")}
                >
                  <Ban size={16} className="mr-1.5" strokeWidth={2} />
                  Cancel order
                </Button>
              </div>

              <div className="mt-3 flex gap-3">
                <Button variant="secondary" className="flex-1" onClick={onClose}>
                  Close
                </Button>
                <Button className="flex-1" disabled={!canSave} isLoading={saveMutation.isPending} onClick={handleSave}>
                  Save changes
                </Button>
              </div>
            </>
          ) : (
            <div className="mt-5">
              <Button variant="secondary" className="w-full" onClick={onClose}>
                Close
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
