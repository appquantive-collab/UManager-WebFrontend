import { useEffect, useRef } from "react";
import clsx from "clsx";

interface Tab {
  key: string;
  label: string;
}

interface TabsProps {
  tabs: Tab[];
  active: string;
  onChange: (key: string) => void;
}

/**
 * Segmented tabs. On narrow screens the row scrolls sideways inside itself
 * (never stretching the page), and the selected tab is kept in view.
 */
export function Tabs({ tabs, active, onChange }: TabsProps) {
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const row = rowRef.current;
    const button = row?.querySelector<HTMLButtonElement>(`[data-tab="${CSS.escape(active)}"]`);
    if (!row || !button) return;
    const left = button.offsetLeft - (row.clientWidth - button.offsetWidth) / 2;
    row.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
  }, [active]);

  return (
    <div ref={rowRef} className="scrollbar-hide max-w-full overflow-x-auto">
      <div role="tablist" className="inline-flex items-center gap-1 rounded-lg bg-surface-variant p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            data-tab={tab.key}
            aria-selected={active === tab.key}
            onClick={() => onChange(tab.key)}
            className={clsx(
              "shrink-0 whitespace-nowrap rounded-md px-4 py-1.5 text-sm font-medium outline-none transition-colors",
              "focus-visible:ring-2 focus-visible:ring-primary/40",
              active === tab.key ? "bg-surface text-text shadow-elevation-1" : "text-text-muted hover:text-text"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
