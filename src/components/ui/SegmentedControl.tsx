import clsx from "clsx";

interface Segment {
  key: string;
  label: string;
}

interface SegmentedControlProps {
  segments: Segment[];
  active: string;
  onChange: (key: string) => void;
}

export function SegmentedControl({ segments, active, onChange }: SegmentedControlProps) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-lg bg-surface-variant p-1">
      {segments.map((segment) => (
        <button
          key={segment.key}
          type="button"
          onClick={() => onChange(segment.key)}
          className={clsx(
            "rounded-md px-3.5 py-1.5 text-sm font-medium outline-none transition-colors",
            "focus-visible:ring-2 focus-visible:ring-primary/40",
            active === segment.key
              ? "bg-text text-surface"
              : "text-text-muted hover:text-text"
          )}
        >
          {segment.label}
        </button>
      ))}
    </div>
  );
}
