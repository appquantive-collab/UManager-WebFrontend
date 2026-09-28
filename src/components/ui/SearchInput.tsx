import { Search } from "lucide-react";
import type { InputHTMLAttributes } from "react";
import clsx from "clsx";

export function SearchInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative flex-1">
      <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" />
      <input
        className={clsx(
          "w-full rounded-lg border border-surface-variant bg-surface-muted py-3 pl-10 pr-4 text-[15px] text-text outline-none",
          "placeholder:text-text-muted/80 focus:border-primary/40 focus:ring-2 focus:ring-primary/20",
          className
        )}
        {...props}
      />
    </div>
  );
}
