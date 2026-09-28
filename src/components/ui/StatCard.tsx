interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
}

export function StatCard({ label, value, hint }: StatCardProps) {
  return (
    <div className="rounded-2xl bg-surface p-5 shadow-elevation-1">
      <div className="text-sm text-text-muted">{label}</div>
      <div className="mt-2 text-2xl font-bold text-text">{value}</div>
      {hint ? <div className="mt-1 text-xs text-text-muted">{hint}</div> : null}
    </div>
  );
}
