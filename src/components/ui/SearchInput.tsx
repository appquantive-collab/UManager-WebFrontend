import { Search } from "lucide-react";
import type { InputHTMLAttributes } from "react";
import clsx from "clsx";

/**
 * Search box. \`className\` sizes the whole box (e.g. "w-full sm:w-72"); without it
 * the box stretches to fill its row. The input always fills the box.
 */
export function SearchInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={clsx("relative min-w-0", className ?? "flex-1")}>
      <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-icon" aria-hidden="true" />
      <input
        type="search"
        className={clsx(
          "w-full min-w-0 rounded-lg border border-surface-variant bg-surface-muted py-3 pl-10 pr-4 text-[0.9375rem] text-text outline-none",
          "placeholder:text-text-muted focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
        )}
        {...props}
      />
    </div>
  );
}
