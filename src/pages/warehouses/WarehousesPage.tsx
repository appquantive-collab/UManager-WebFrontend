import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Star, Warehouse as WarehouseIcon } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { formatCurrency } from "../../lib/format";
import { listWarehousesWithStats } from "../../lib/warehouses-api";
import { AddWarehouseModal } from "../../components/warehouses/AddWarehouseModal";

export function WarehousesPage() {
  const [addOpen, setAddOpen] = useState(false);
  const warehousesQuery = useQuery({ queryKey: ["warehouses"], queryFn: listWarehousesWithStats });
  const warehouses = warehousesQuery.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={() => setAddOpen(true)}>
          <Plus size={16} className="mr-1.5" strokeWidth={2} />
          Add warehouse
        </Button>
      </div>

      {warehousesQuery.isLoading ? (
        <p className="p-6 text-sm text-text-muted">Loading warehouses…</p>
      ) : warehouses.length === 0 ? (
        <EmptyState
          icon={WarehouseIcon}
          title="No warehouses yet"
          description="Add a warehouse to start tracking stock by location."
          action={<Button onClick={() => setAddOpen(true)}>Add warehouse</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {warehouses.map((warehouse) => (
            <div
              key={warehouse._id}
              className="rounded-2xl bg-surface p-6 shadow-elevation-1 transition-shadow hover:shadow-elevation-2"
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h3 className="truncate text-sm font-semibold text-text">{warehouse.name}</h3>
                    {warehouse.isDefault ? <Star size={13} className="shrink-0 fill-warning text-warning" /> : null}
                  </div>
                  <p className="mt-1 text-xs text-text-muted">{warehouse.location || "No location set"}</p>
                </div>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-muted">
                  <WarehouseIcon size={16} className="text-text-muted" />
                </div>
              </div>

              <dl className="mt-6 grid grid-cols-2 gap-2">
                <div>
                  <dt className="text-xs text-text-muted">Stock Value</dt>
                  <dd className="mt-1 text-sm font-semibold text-text">{formatCurrency(warehouse.stockValue)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-text-muted">SKUs Stocked</dt>
                  <dd className="mt-1 text-sm font-semibold text-text">{warehouse.skuCount}</dd>
                </div>
              </dl>
            </div>
          ))}
        </div>
      )}

      <AddWarehouseModal open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}
