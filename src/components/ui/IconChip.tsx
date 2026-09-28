import type { ReactNode } from "react";

export function IconChip({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
      style={{ backgroundColor: `${color}1a`, color }}
    >
      {children}
    </span>
  );
}
