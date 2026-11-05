import { useEffect } from "react";
import { useTranslation } from "react-i18next";
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
  { key: "newOrder", labelEn: "New Order", icon: Sparkles, className: "bg-primary-container text-primary" },
  { key: "newSale", labelEn: "New Sale", icon: ShoppingCart, className: "bg-success-container text-success" },
  { key: "addPurchase", labelEn: "Add Purchase", icon: Truck, className: "bg-info-container text-info" },
  { key: "addStock", labelEn: "Add Stock", icon: Package, className: "bg-success-container text-success" },
  { key: "addCustomer", labelEn: "Add Customer", icon: Users, className: "bg-secondary-container text-on-secondary-container" },
  { key: "receivePayment", labelEn: "Receive Payment", icon: Receipt, className: "bg-warning-container text-warning" },
  { key: "scanProduct", labelEn: "Scan Product", icon: ScanLine, className: "bg-surface-muted text-text" },
  { key: "voiceEntry", labelEn: "Voice Entry", icon: Mic, className: "bg-danger-container text-danger" },
] as const;

interface QuickActionSheetProps {
  open: boolean;
  onClose: () => void;
  onNewOrder?: () => void;
  onNewSale?: () => void;
}

export function QuickActionSheet({ open, onClose, onNewOrder, onNewSale }: QuickActionSheetProps) {
  const { t } = useTranslation();

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
      <button
        type="button"
        aria-label={t("layoutExtra.quickActionSheet.closeQuickActions")}
        onClick={onClose}
        className="absolute inset-0 bg-text/40"
      />

      <div className="relative w-full rounded-t-2xl bg-surface p-5 pb-[calc(env(safe-area-inset-bottom)+20px)] shadow-elevation-3">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-headline text-base font-bold text-text">{t("layoutExtra.quickActionSheet.title")}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("layoutExtra.quickActionSheet.close")}
            className="rounded-full p-1.5 text-text-muted outline-none transition-colors hover:bg-surface-muted hover:text-text focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-4 gap-3">
          {actions.map((action) => (
            <button
              key={action.key}
              type="button"
              onClick={() => {
                onClose();
                if (action.key === "newOrder") onNewOrder?.();
                if (action.key === "newSale") onNewSale?.();
              }}
              className="flex flex-col items-center gap-2 outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${action.className}`}>
                <action.icon size={22} />
              </span>
              <span className="text-center font-label text-[10px] font-semibold leading-tight text-text">
                {t(`layoutExtra.quickActionSheet.${action.key}`)}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
