import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Bell, ChevronRight, ClipboardList, PackageX, Truck, Wallet, type LucideIcon } from "lucide-react";
import clsx from "clsx";
import { getDashboardSummary } from "../../lib/dashboard-api";
import { formatCurrency } from "../../lib/format";

// The bell: real alerts from the business (orders to bill, low stock, money to
// collect, money owed to suppliers), each leading to the page that fixes it.
// The badge counts the alerts — no placeholder numbers.

interface Alert {
  key: string;
  icon: LucideIcon;
  title: string;
  detail?: string;
  to: string;
  urgent?: boolean;
}

export function NotificationsMenu({ variant }: { variant: "mobile" | "desktop" }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const { data: summary } = useQuery({ queryKey: ["dashboard-summary"], queryFn: getDashboardSummary, staleTime: 60_000 });

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const alerts: Alert[] = [];
  if (summary?.pendingOrderCount)
    alerts.push({
      key: "orders",
      icon: ClipboardList,
      title: t("notifications.ordersToBill", { count: summary.pendingOrderCount }),
      detail: t("notifications.ordersToBillHint"),
      to: "/app/sales?tab=orders",
      urgent: true,
    });
  if (summary?.lowStockCount)
    alerts.push({
      key: "stock",
      icon: PackageX,
      title: t("notifications.lowStock", { count: summary.lowStockCount }),
      detail: summary.lowStockItems.slice(0, 3).join(", "),
      to: "/app/inventory",
      urgent: true,
    });
  if (summary && summary.receivables > 0)
    alerts.push({
      key: "collect",
      icon: Wallet,
      title: t("notifications.toCollect", { amount: formatCurrency(summary.receivables) }),
      detail: summary.topOverdueCustomerName
        ? t("notifications.toCollectTop", { name: summary.topOverdueCustomerName, amount: formatCurrency(summary.topOverdueAmount) })
        : undefined,
      to: "/app/customers",
    });
  if (summary && summary.payables > 0)
    alerts.push({
      key: "pay",
      icon: Truck,
      title: t("notifications.toPay", { amount: formatCurrency(summary.payables) }),
      detail: t("notifications.toPayHint"),
      to: "/app/purchases",
    });

  const count = alerts.length;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={count > 0 ? t("notifications.labelWithCount", { count }) : t("layout.notifications")}
        className={clsx(
          "relative flex items-center justify-center outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/40",
          variant === "mobile"
            ? "h-9 w-9 rounded-xl border border-border bg-surface hover:bg-surface-muted"
            : "h-10 w-10 rounded-xl border border-border bg-surface hover:bg-surface-muted",
          open ? "text-text" : "text-icon hover:text-text"
        )}
      >
        <Bell size={18} strokeWidth={1.75} aria-hidden="true" />
        {count > 0 ? (
          <span
            aria-hidden="true"
            className="absolute -right-1 -top-1 flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-danger px-1 text-[0.6875rem] font-bold leading-none tabular-nums text-white ring-2 ring-surface"
          >
            {count}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-border bg-surface shadow-elevation-3"
        >
          <div className="border-b border-border px-4 py-3">
            <p className="text-sm font-bold text-text">{t("notifications.title")}</p>
          </div>
          {alerts.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <Bell size={28} strokeWidth={1.5} className="mx-auto text-icon" aria-hidden="true" />
              <p className="mt-2 text-sm font-semibold text-text">{t("notifications.allCaughtUp")}</p>
              <p className="mt-0.5 text-xs text-text-muted">{t("notifications.allCaughtUpHint")}</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {alerts.map((alert) => (
                <li key={alert.key}>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setOpen(false);
                      navigate(alert.to);
                    }}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left outline-none transition-colors hover:bg-surface-muted focus-visible:bg-surface-muted"
                  >
                    <alert.icon size={18} strokeWidth={1.75} className="mt-0.5 shrink-0 text-icon" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 text-sm font-semibold text-text">
                        {alert.urgent ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-danger" aria-hidden="true" /> : null}
                        {alert.title}
                      </span>
                      {alert.detail ? <span className="mt-0.5 block truncate text-xs text-text-muted">{alert.detail}</span> : null}
                    </span>
                    <ChevronRight size={16} className="mt-0.5 shrink-0 text-icon" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
