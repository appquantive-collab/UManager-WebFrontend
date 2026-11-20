import { AudioLines } from "lucide-react";
import clsx from "clsx";

/** VoiceMunshi logo: an orange voice badge and the two-tone wordmark. */
export function BrandMark({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={clsx("flex min-w-0 items-center gap-2", className)}>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-gradient text-white shadow-[0_4px_10px_-4px_rgba(184,64,13,0.6)]" aria-hidden="true">
        <AudioLines size={17} strokeWidth={2.2} />
      </span>
      {compact ? null : (
        <span className="truncate text-[1.1875rem] font-extrabold tracking-tight">
          <span className="text-text">Voice</span>
          <span className="text-primary">Munshi</span>
        </span>
      )}
    </span>
  );
}
