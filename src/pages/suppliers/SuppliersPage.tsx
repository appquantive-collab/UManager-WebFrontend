import { Building2, Phone, Plus } from "lucide-react";
import { Avatar } from "../../components/ui/Avatar";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { formatCurrency } from "../../lib/format";
import { mockSuppliers } from "../../lib/mock-data";

export function SuppliersPage() {
  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button>
          <Plus size={16} className="mr-1.5" strokeWidth={2} />
          Add supplier
        </Button>
      </div>

      {mockSuppliers.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No suppliers yet"
          description="Add your first supplier to start recording purchases."
          action={<Button>Add supplier</Button>}
        />
      ) : (
        <div className="space-y-3">
          {mockSuppliers.map((supplier) => (
            <div
              key={supplier.id}
              className="flex flex-col gap-4 rounded-2xl bg-surface p-5 shadow-elevation-1 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-center gap-4">
                <Avatar name={supplier.name} />
                <div>
                  <div className="font-semibold text-text">{supplier.name}</div>
                  <div className="mt-1 flex items-center gap-1.5 text-sm text-text-muted">
                    <Phone size={13} />
                    {supplier.phone}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-6 sm:gap-8">
                <div className="text-left sm:text-right">
                  <div className="text-xs text-text-muted">Total Purchased</div>
                  <div className="mt-0.5 text-sm font-medium text-text">{formatCurrency(supplier.totalPurchased)}</div>
                </div>
                <div className="text-left sm:text-right">
                  <div className="text-xs text-text-muted">Outstanding</div>
                  <div className="mt-0.5">
                    {supplier.outstanding > 0 ? (
                      <Badge tone="warning">{formatCurrency(supplier.outstanding)}</Badge>
                    ) : (
                      <span className="text-sm text-text-muted">—</span>
                    )}
                  </div>
                </div>
                <div className="text-left sm:text-right">
                  <div className="text-xs text-text-muted">Last Order</div>
                  <div className="mt-0.5 text-sm text-text-muted">{supplier.lastOrder}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
