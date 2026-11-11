import clsx from "clsx";

interface Segment {
  key: string;
  label: string;
}

interface SegmentedControlProps {
  segments: Segment[];
  active: string;
  onChange: (key: string) => void;
  className?: string;
}

export function SegmentedControl({ segments, active, onChange, className }: SegmentedControlProps) {
  return (
    <div role="group" className={clsx("inline-flex shrink-0 items-center gap-0.5 rounded-lg bg-surface-variant p-1", className)}>
      {segments.map((segment) => (
        <button
          key={segment.key}
          type="button"
          onClick={() => onChange(segment.key)}
          aria-pressed={active === segment.key}
          className={clsx(
            // flex-1: equal segments when the control is stretched; no effect when it isn't.
            "flex-1 whitespace-nowrap rounded-md px-3.5 py-2 text-sm font-medium outline-none transition-colors",
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
