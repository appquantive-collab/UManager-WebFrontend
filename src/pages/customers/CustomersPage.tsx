import { Phone, Plus, Users } from "lucide-react";
import { Avatar } from "../../components/ui/Avatar";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { formatCurrency } from "../../lib/format";
import { mockCustomers } from "../../lib/mock-data";

function creditTone(outstanding: number, limit: number) {
  const pct = limit === 0 ? 0 : outstanding / limit;
  if (pct >= 1) return "danger" as const;
  if (pct >= 0.7) return "warning" as const;
  return "success" as const;
}

export function CustomersPage() {
  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button>
          <Plus size={16} className="mr-1.5" strokeWidth={2} />
          Add customer
        </Button>
      </div>

      {mockCustomers.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No customers yet"
          description="Add your first customer to start recording sales and tracking credit."
          action={<Button>Add customer</Button>}
        />
      ) : (
        <div className="space-y-3">
          {mockCustomers.map((customer) => (
            <div
              key={customer.id}
              className="flex flex-col gap-4 rounded-2xl bg-surface p-5 shadow-elevation-1 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-center gap-4">
                <Avatar name={customer.name} />
                <div>
                  <div className="font-semibold text-text">{customer.name}</div>
                  <div className="mt-1 flex items-center gap-1.5 text-sm text-text-muted">
                    <Phone size={13} />
                    {customer.phone}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-6 sm:gap-8">
                <div className="text-left sm:text-right">
                  <div className="text-xs text-text-muted">Total Purchases</div>
                  <div className="mt-0.5 text-sm font-medium text-text">{formatCurrency(customer.totalPurchases)}</div>
                </div>
                <div className="text-left sm:text-right">
                  <div className="text-xs text-text-muted">Outstanding</div>
                  <div className="mt-0.5">
                    {customer.outstanding > 0 ? (
                      <Badge tone={creditTone(customer.outstanding, customer.creditLimit)}>
                        {formatCurrency(customer.outstanding)}
                      </Badge>
                    ) : (
                      <span className="text-sm text-text-muted">—</span>
                    )}
                  </div>
                </div>
                <div className="text-left sm:text-right">
                  <div className="text-xs text-text-muted">Credit Limit</div>
                  <div className="mt-0.5 text-sm font-medium text-text">{formatCurrency(customer.creditLimit)}</div>
                </div>
                <div className="text-left sm:text-right">
                  <div className="text-xs text-text-muted">Last Purchase</div>
                  <div className="mt-0.5 text-sm text-text-muted">{customer.lastPurchase}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
