import { useState } from "react";
import { BarChart3 } from "lucide-react";
import { EmptyState } from "../../components/ui/EmptyState";
import { StatCard } from "../../components/ui/StatCard";
import { Tabs } from "../../components/ui/Tabs";
import { formatCurrency } from "../../lib/format";
import { mockReports } from "../../lib/mock-data";

const tabs = [
  { key: "sales", label: "Sales" },
  { key: "purchases", label: "Purchases" },
  { key: "inventory", label: "Inventory" },
  { key: "financial", label: "Financial" },
];

function SalesReport() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <StatCard label="Today" value={formatCurrency(mockReports.sales.today)} />
      <StatCard label="This Week" value={formatCurrency(mockReports.sales.week)} />
      <StatCard label="This Month" value={formatCurrency(mockReports.sales.month)} />
    </div>
  );
}

function FinancialReport() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <StatCard label="Inventory Value" value={formatCurrency(mockReports.inventoryValue)} />
      <StatCard label="Gross Profit (Month)" value={formatCurrency(mockReports.grossProfit)} />
    </div>
  );
}

function ComingSoon({ label }: { label: string }) {
  return <EmptyState icon={BarChart3} title={`${label} report coming soon`} description="This report is being designed." />;
}

export function ReportsPage() {
  const [tab, setTab] = useState("sales");

  return (
    <div className="space-y-6">
      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === "sales" && <SalesReport />}
      {tab === "purchases" && <ComingSoon label="Purchases" />}
      {tab === "inventory" && <ComingSoon label="Inventory" />}
      {tab === "financial" && <FinancialReport />}
    </div>
  );
}
