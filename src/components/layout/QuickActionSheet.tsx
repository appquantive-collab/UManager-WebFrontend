import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuthStore, type UserRole } from "../../lib/auth-store";
import { useAppSetup } from "../../lib/use-app-setup";
import {
  Package,
  Receipt,
  ScanLine,
  ShoppingCart,
  Sparkles,
  Truck,
  Users,
  Wallet,
  X,
} from "lucide-react";

const actions = [
  { key: "newOrder", labelEn: "New Order", icon: Sparkles },
  { key: "newSale", labelEn: "New Sale", icon: ShoppingCart },
  { key: "addPurchase", labelEn: "Add Purchase", icon: Truck },
  { key: "addStock", labelEn: "Add Stock", icon: Package },
  { key: "addCustomer", labelEn: "Add Customer", icon: Users },
  { key: "receivePayment", labelEn: "Receive Payment", icon: Receipt },
  { key: "scanProduct", labelEn: "Scan Product", icon: ScanLine },
  { key: "addExpense", labelEn: "Add Expense", icon: Wallet },
] as const;

// Tiles a staff role can't use (owner and manager get all of them).
const hiddenFor: Partial<Record<UserRole, string[]>> = {
  SALESMAN: ["addPurchase", "addExpense", "addStock"],
  WAREHOUSE_STAFF: ["newOrder", "newSale", "addCustomer", "receivePayment", "addExpense"],
};

interface QuickActionSheetProps {
  open: boolean;
  onClose: () => void;
  onNewOrder?: () => void;
  onNewSale?: () => void;
  onNewPurchase?: () => void;
  onAddCustomer?: () => void;
  onAddExpense?: () => void;
  onNavigate?: (path: string) => void;
}

export function QuickActionSheet({ open, onClose, onNewOrder, onNewSale, onNewPurchase, onAddCustomer, onAddExpense, onNavigate }: QuickActionSheetProps) {
  const { t } = useTranslation();
  const role = useAuthStore((state) => state.user?.role);
  const { features } = useAppSetup();
  const visible = actions.filter(
    (a) =>
      !(role && hiddenFor[role]?.includes(a.key)) &&
      !(a.key === "newOrder" && !features.orders) &&
      !(a.key === "addPurchase" && !features.purchases)
  );

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

      {/* Bottom padding clears the floating dock, whose + (now ×) closes this sheet. */}
      <div className="relative w-full rounded-t-3xl bg-surface p-5 pb-[calc(max(0.75rem,env(safe-area-inset-bottom))+5.75rem)] shadow-elevation-3 motion-safe:animate-[sheet-up_240ms_cubic-bezier(0.22,1,0.36,1)]">
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
          {visible.map((action) => (
            <button
              key={action.key}
              type="button"
              onClick={() => {
                onClose();
                // Every tile leads somewhere: forms open directly, the rest go to their page.
                if (action.key === "newOrder") onNewOrder?.();
                if (action.key === "addExpense") onAddExpense?.();
                if (action.key === "newSale") onNewSale?.();
                if (action.key === "addPurchase") onNewPurchase?.();
                if (action.key === "addCustomer") onAddCustomer?.();
                if (action.key === "addStock" || action.key === "scanProduct") onNavigate?.("/app/inventory");
                if (action.key === "receivePayment") onNavigate?.("/app/sales");
              }}
              className="flex flex-col items-center gap-2 outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border text-icon">
                <action.icon size={22} strokeWidth={1.75} />
              </span>
              <span className="text-center font-label text-xs font-semibold leading-tight text-text">
                {t(`layoutExtra.quickActionSheet.${action.key}`)}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
