interface PlaceholderPageProps {
  title: string;
}

export function PlaceholderPage({ title }: PlaceholderPageProps) {
  return (
    <div className="flex h-full min-h-[60vh] flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border)] text-center">
      <h1 className="text-lg font-semibold text-[var(--color-text)]">{title}</h1>
      <p className="mt-1 text-sm text-[var(--color-text-muted)]">This module is not built yet.</p>
    </div>
  );
}
