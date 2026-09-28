import clsx from "clsx";

type BadgeTone = "success" | "warning" | "danger" | "info" | "neutral";

const toneClasses: Record<BadgeTone, string> = {
  success: "bg-success-container text-success",
  warning: "bg-warning-container text-warning",
  danger: "bg-danger-container text-danger",
  info: "bg-info-container text-info",
  neutral: "bg-surface-variant text-text-muted",
};

export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: string }) {
  return (
    <span className={clsx("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold", toneClasses[tone])}>
      {children}
    </span>
  );
}
