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

export function Tabs({ tabs, active, onChange }: TabsProps) {
  return (
    <div className="inline-flex items-center gap-1 rounded-lg bg-surface-variant p-1">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onChange(tab.key)}
          className={clsx(
            "rounded-md px-4 py-1.5 text-sm font-medium outline-none transition-colors",
            "focus-visible:ring-2 focus-visible:ring-primary/40",
            active === tab.key ? "bg-surface text-text shadow-elevation-1" : "text-text-muted hover:text-text"
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
