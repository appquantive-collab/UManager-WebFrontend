import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Phone, Plus, Users } from "lucide-react";
import { Avatar } from "../../components/ui/Avatar";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { SearchInput } from "../../components/ui/SearchInput";
import { formatCurrency } from "../../lib/format";
import { listCustomers, type CustomerListItem } from "../../lib/customers-api";
import { AddCustomerModal } from "../../components/customers/AddCustomerModal";
import { PartyPortfolioModal } from "../../components/customers/PartyPortfolioModal";

function creditTone(outstanding: number, limit: number) {
  const pct = limit === 0 ? 0 : outstanding / limit;
  if (pct >= 1) return "danger" as const;
  if (pct >= 0.7) return "warning" as const;
  return "success" as const;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function CustomersPage() {
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const customersQuery = useQuery({
    queryKey: ["customers", search],
    queryFn: () => listCustomers(search || undefined),
  });

  const customers = customersQuery.data ?? [];

  return (
    <div className="space-y-4">
      {/* Mobile */}
      <div className="space-y-3 lg:hidden">
        <div className="flex items-center gap-2">
          <SearchInput placeholder="Search parties…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-primary text-on-primary shadow-elevation-1 outline-none transition-colors active:scale-[0.98] hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <Plus size={16} />
          <span className="font-label text-[12px] font-bold uppercase tracking-wide">Add customer</span>
        </button>

        {customersQuery.isLoading ? (
          <p className="py-8 text-center text-sm text-text-muted">Loading parties…</p>
        ) : customers.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No customers yet"
            description="Add your first customer to start recording orders and tracking credit."
            action={<Button onClick={() => setAddOpen(true)}>Add customer</Button>}
          />
        ) : (
          <div className="space-y-3">
            {customers.map((c) => (
              <CustomerCard key={c._id} customer={c} onOpen={() => setSelectedId(c._id)} />
            ))}
          </div>
        )}
      </div>

      {/* Desktop */}
      <div className="hidden space-y-6 lg:block">
        <div className="flex items-center justify-between gap-3">
          <div className="w-72">
            <SearchInput placeholder="Search parties…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Button onClick={() => setAddOpen(true)}>
            <Plus size={16} className="mr-1.5" strokeWidth={2} />
            Add customer
          </Button>
        </div>

        {customersQuery.isLoading ? (
          <p className="p-6 text-sm text-text-muted">Loading parties…</p>
        ) : customers.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No customers yet"
            description="Add your first customer to start recording sales and tracking credit."
            action={<Button onClick={() => setAddOpen(true)}>Add customer</Button>}
          />
        ) : (
          <div className="space-y-3">
            {customers.map((customer) => (
              <button
                key={customer._id}
                type="button"
                onClick={() => setSelectedId(customer._id)}
                className="flex w-full flex-col gap-4 rounded-2xl bg-surface p-5 text-left shadow-elevation-1 outline-none transition-shadow hover:shadow-elevation-2 focus-visible:ring-2 focus-visible:ring-primary/40 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-4">
                  <Avatar name={customer.name} />
                  <div>
                    <div className="font-semibold text-text">{customer.name}</div>
                    {customer.phone ? (
                      <div className="mt-1 flex items-center gap-1.5 text-sm text-text-muted">
                        <Phone size={13} />
                        {customer.phone}
                      </div>
                    ) : null}
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
                    <div className="mt-0.5 text-sm text-text-muted">{formatDate(customer.lastPurchaseAt)}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <AddCustomerModal open={addOpen} onClose={() => setAddOpen(false)} />
      <PartyPortfolioModal customerId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}

function CustomerCard({ customer, onOpen }: { customer: CustomerListItem; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full rounded-2xl bg-surface p-5 text-left shadow-elevation-1 outline-none transition-shadow active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-primary/40"
    >
      <div className="flex items-center gap-3">
        <Avatar name={customer.name} />
        <div className="min-w-0">
          <div className="truncate font-semibold text-text">{customer.name}</div>
          {customer.phone ? (
            <div className="mt-0.5 flex items-center gap-1.5 text-sm text-text-muted">
              <Phone size={13} />
              {customer.phone}
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <div>
          <div className="text-xs text-text-muted">Total Purchases</div>
          <div className="mt-0.5 text-sm font-semibold text-text">{formatCurrency(customer.totalPurchases)}</div>
        </div>
        <div>
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
        <div>
          <div className="text-xs text-text-muted">Credit Limit</div>
          <div className="mt-0.5 text-sm font-semibold text-text">{formatCurrency(customer.creditLimit)}</div>
        </div>
      </div>

      <div className="mt-3 border-t border-border pt-3">
        <div className="text-xs text-text-muted">Last Purchase</div>
        <div className="mt-0.5 text-sm text-text-muted">{formatDate(customer.lastPurchaseAt)}</div>
      </div>
    </button>
  );
}
