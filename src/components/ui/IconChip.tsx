import type { ReactNode } from "react";

/** A plain light-grey icon slot (no tinted background), sized like the old chip so layouts don't shift. */
export function IconChip({ children }: { children: ReactNode }) {
  return <span className="flex h-8 w-8 shrink-0 items-center justify-center text-icon">{children}</span>;
}
