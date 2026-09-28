import { useState } from "react";
import { FileText, Plus, Truck } from "lucide-react";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { Tabs } from "../../components/ui/Tabs";
import { formatCurrency } from "../../lib/format";
import { mockPurchaseOrders } from "../../lib/mock-data";

const tabs = [
  { key: "orders", label: "Purchase Orders" },
  { key: "purchases", label: "Purchases" },
  { key: "returns", label: "Purchase Returns" },
  { key: "payments", label: "Supplier Payments" },
];

const statusTone = {
  "Pending Receipt": "warning",
  Received: "success",
} as const;

function PurchaseOrdersTable() {
  if (mockPurchaseOrders.length === 0) {
    return (
      <EmptyState
        icon={Truck}
        title="No purchase orders yet"
        description="Create a purchase order to start tracking incoming stock."
        action={<Button>New purchase order</Button>}
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl bg-surface shadow-elevation-1">
      <table className="w-full min-w-max text-sm">
        <thead>
          <tr className="text-left text-xs font-medium uppercase tracking-wide text-text-muted">
            <th className="px-4 py-3">PO</th>
            <th className="px-4 py-3">Supplier</th>
            <th className="px-4 py-3">Items</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 text-right">Amount</th>
            <th className="px-4 py-3 text-right">Date</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-variant">
          {mockPurchaseOrders.map((po) => (
            <tr key={po.id} className="hover:bg-surface-muted">
              <td className="px-4 py-3 font-medium text-text">{po.id}</td>
              <td className="px-4 py-3 text-text">{po.supplier}</td>
              <td className="px-4 py-3 text-text-muted">{po.items}</td>
              <td className="px-4 py-3">
                <Badge tone={statusTone[po.status as keyof typeof statusTone] ?? "neutral"}>{po.status}</Badge>
              </td>
              <td className="px-4 py-3 text-right text-text">{formatCurrency(po.amount)}</td>
              <td className="px-4 py-3 text-right text-text-muted">{po.date}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ComingSoon({ label }: { label: string }) {
  return (
    <EmptyState icon={FileText} title={`${label} coming soon`} description="This section is being designed." />
  );
}

export function PurchasesPage() {
  const [tab, setTab] = useState("orders");

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button>
          <Plus size={16} className="mr-1.5" strokeWidth={2} />
          New purchase order
        </Button>
      </div>

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === "orders" && <PurchaseOrdersTable />}
      {tab === "purchases" && <ComingSoon label="Purchases" />}
      {tab === "returns" && <ComingSoon label="Purchase Returns" />}
      {tab === "payments" && <ComingSoon label="Supplier Payments" />}
    </div>
  );
}
