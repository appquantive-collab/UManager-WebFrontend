import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl bg-surface py-16 text-center shadow-elevation-1">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-container">
        <Icon size={22} strokeWidth={1.5} className="text-primary" />
      </div>
      <h3 className="mt-4 text-sm font-semibold text-text">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-text-muted">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
