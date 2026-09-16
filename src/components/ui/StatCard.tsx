interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
}

export function StatCard({ label, value, hint }: StatCardProps) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
      <div className="text-sm text-[var(--color-text-muted)]">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-[var(--color-text)]">{value}</div>
      {hint ? <div className="mt-1 text-xs text-[var(--color-text-muted)]">{hint}</div> : null}
    </div>
  );
}
