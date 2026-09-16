import { StatCard } from "../components/ui/StatCard";

export function DashboardPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-[var(--color-text)]">Dashboard</h1>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          Business overview for today.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Today's Sales" value="₹0" />
        <StatCard label="Today's Purchases" value="₹0" />
        <StatCard label="Inventory Value" value="₹0" />
        <StatCard label="Receivables" value="₹0" />
      </div>

      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
        <h2 className="text-sm font-semibold text-[var(--color-text)]">AI Business Summary</h2>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">
          No data yet. Connect the backend and start recording sales to see AI-generated insights here.
        </p>
      </div>
    </div>
  );
}
