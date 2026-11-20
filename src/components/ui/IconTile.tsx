import type { LucideIcon } from "lucide-react";
import clsx from "clsx";

export type TileTone = "sale" | "order" | "stock" | "pay" | "brand" | "success" | "danger" | "info" | "warning" | "neutral";

// Coloured icons on the card itself: no tinted background behind them.
const TONES: Record<TileTone, string> = {
  sale: "text-tile-sale",
  order: "text-tile-order",
  stock: "text-tile-stock",
  pay: "text-tile-pay",
  brand: "text-primary",
  success: "text-success",
  danger: "text-danger",
  info: "text-info",
  warning: "text-warning",
  neutral: "text-icon",
};

const SIZES = {
  lg: { box: "h-10 w-10", icon: 28 },
  md: { box: "h-9 w-9", icon: 26 },
  sm: { box: "h-8 w-8", icon: 20 },
} as const;

/**
 * An icon in a soft tinted square (the design system's quick-action and list
 * icon). Use it where colour helps people tell actions apart, not everywhere.
 */
export function IconTile({
  icon: Icon,
  tone = "neutral",
  size = "md",
  badge,
  className,
}: {
  icon: LucideIcon;
  tone?: TileTone;
  size?: keyof typeof SIZES;
  /** Kept for callers; icons have no background shape any more. */
  round?: boolean;
  /** A small mark on the corner, e.g. a ₹ on a person for "payment". */
  badge?: React.ReactNode;
  className?: string;
}) {
  const s = SIZES[size];
  return (
    <span className={clsx("relative flex shrink-0 items-center justify-center", s.box, TONES[tone], className)} aria-hidden="true">
      <Icon size={s.icon} strokeWidth={1.9} />
      {badge}
    </span>
  );
}
