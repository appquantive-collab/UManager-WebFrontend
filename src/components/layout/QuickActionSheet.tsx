import { useEffect } from "react";
import {
  Mic,
  Package,
  Receipt,
  ScanLine,
  ShoppingCart,
  Sparkles,
  Truck,
  Users,
  X,
} from "lucide-react";

const actions = [
  { label: "New Order", icon: Sparkles, className: "bg-primary-container text-primary" },
  { label: "New Sale", icon: ShoppingCart, className: "bg-success-container text-success" },
  { label: "Add Purchase", icon: Truck, className: "bg-info-container text-info" },
  { label: "Add Stock", icon: Package, className: "bg-success-container text-success" },
  { label: "Add Customer", icon: Users, className: "bg-secondary-container text-on-secondary-container" },
  { label: "Receive Payment", icon: Receipt, className: "bg-warning-container text-warning" },
  { label: "Scan Product", icon: ScanLine, className: "bg-surface-muted text-text" },
  { label: "Voice Entry", icon: Mic, className: "bg-danger-container text-danger" },
];

interface QuickActionSheetProps {
  open: boolean;
  onClose: () => void;
  onNewOrder?: () => void;
  onNewSale?: () => void;
}

export function QuickActionSheet({ open, onClose, onNewOrder, onNewSale }: QuickActionSheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:hidden">
      <button type="button" aria-label="Close quick actions" onClick={onClose} className="absolute inset-0 bg-text/40" />

      <div className="relative w-full rounded-t-2xl bg-surface p-5 pb-[calc(env(safe-area-inset-bottom)+20px)] shadow-elevation-3">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-headline text-base font-bold text-text">Quick Actions</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1.5 text-text-muted outline-none transition-colors hover:bg-surface-muted hover:text-text focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-4 gap-3">
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={() => {
                onClose();
                if (action.label === "New Order") onNewOrder?.();
                if (action.label === "New Sale") onNewSale?.();
              }}
              className="flex flex-col items-center gap-2 outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${action.className}`}>
                <action.icon size={22} />
              </span>
              <span className="text-center font-label text-[10px] font-semibold leading-tight text-text">
                {action.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
