import { Plus, Warehouse as WarehouseIcon } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { formatCurrency } from "../../lib/format";
import { mockWarehouses } from "../../lib/mock-data";

export function WarehousesPage() {
  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button>
          <Plus size={16} className="mr-1.5" strokeWidth={2} />
          Add warehouse
        </Button>
      </div>

      {mockWarehouses.length === 0 ? (
        <EmptyState
          icon={WarehouseIcon}
          title="No warehouses yet"
          description="Add a warehouse to start tracking stock by location."
          action={<Button>Add warehouse</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {mockWarehouses.map((warehouse) => (
            <div key={warehouse.id} className="rounded-2xl bg-surface p-6 shadow-elevation-1 transition-shadow hover:shadow-elevation-2">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-text">{warehouse.name}</h3>
                  <p className="mt-1 text-xs text-text-muted">{warehouse.location}</p>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-muted">
                  <WarehouseIcon size={16} className="text-text-muted" />
                </div>
              </div>

              <dl className="mt-6 grid grid-cols-3 gap-2">
                <div>
                  <dt className="text-xs text-text-muted">Stock Value</dt>
                  <dd className="mt-1 text-sm font-semibold text-text">{formatCurrency(warehouse.stockValue)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-text-muted">Products</dt>
                  <dd className="mt-1 text-sm font-semibold text-text">{warehouse.products}</dd>
                </div>
                <div>
                  <dt className="text-xs text-text-muted">Staff</dt>
                  <dd className="mt-1 text-sm font-semibold text-text">{warehouse.staff}</dd>
                </div>
              </dl>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
