import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CheckCircle2, ClipboardList, MessageCircle, PackageX, Phone, Wallet } from "lucide-react";
import { formatCurrency } from "../../lib/format";
import type { DashboardSummary } from "../../lib/dashboard-api";
import { indianMobile, whatsappLink } from "../../lib/phone";

// The day's to-do list for a trader: who to collect money from, what to
// reorder, and which orders are waiting. Each row leads straight to the action.

export function NeedsAttention({ summary, businessName }: { summary?: DashboardSummary; businessName?: string }) {
  const { t } = useTranslation();
  const dues = summary?.topDues ?? [];
  const lowStock = summary?.lowStockDetails ?? [];
  const pendingOrders = summary?.pendingOrderCount ?? 0;
  const allClear = Boolean(summary) && dues.length === 0 && lowStock.length === 0 && pendingOrders === 0;

  return (
    <section className="flex h-full flex-col rounded-2xl border border-border bg-surface shadow-elevation-1" aria-labelledby="needs-attention">
      <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-4">
        <h2 id="needs-attention" className="text-base font-bold text-text">
          {t("dashboard.attention.title")}
        </h2>
        {!allClear && summary ? (
          <span className="rounded-full bg-danger px-2.5 py-0.5 text-xs font-bold text-white">
            {dues.length + lowStock.length + (pendingOrders > 0 ? 1 : 0)}
          </span>
        ) : null}
      </div>

      {!summary ? (
        <div className="space-y-3 p-5" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-xl bg-surface-variant" />
          ))}
        </div>
      ) : allClear ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-5 py-10 text-center">
          <CheckCircle2 size={32} strokeWidth={1.5} className="text-icon" aria-hidden="true" />
          <p className="text-sm font-semibold text-text">{t("dashboard.attention.allClear")}</p>
          <p className="text-sm text-text-muted">{t("dashboard.attention.allClearHint")}</p>
        </div>
      ) : (
        <div className="flex-1 divide-y divide-border">
          {dues.length > 0 ? (
            <div className="px-5 py-4">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-text-muted">
                <Wallet size={14} className="text-icon" aria-hidden="true" />
                {t("dashboard.attention.collect")}
              </p>
              <ul className="space-y-2.5">
                {dues.map((due) => {
                  const mobile = indianMobile(due.phone);
                  const reminder = t("dashboard.attention.reminderMessage", {
                    name: due.name,
                    amount: formatCurrency(due.due),
                    business: businessName ?? "SethSathi",
                  });
                  return (
                    <li key={due.customerId} className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-text">{due.name}</p>
                        <p className="text-xs text-text-muted">
                          {t("dashboard.attention.bills", { count: due.invoiceCount })}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-bold tabular-nums text-danger">{formatCurrency(due.due)}</span>
                      {mobile ? (
                        <div className="flex shrink-0 gap-1.5">
                          <a
                            href={`tel:+${mobile}`}
                            aria-label={t("dashboard.attention.call", { name: due.name })}
                            title={t("dashboard.attention.call", { name: due.name })}
                            className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-text outline-none transition-colors hover:border-primary hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/40"
                          >
                            <Phone size={16} aria-hidden="true" />
                          </a>
                          <a
                            href={whatsappLink(mobile, reminder)}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={t("dashboard.attention.whatsapp", { name: due.name })}
                            title={t("dashboard.attention.whatsapp", { name: due.name })}
                            className="flex h-9 w-9 items-center justify-center rounded-full bg-success text-white outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-success/40"
                          >
                            <MessageCircle size={16} aria-hidden="true" />
                          </a>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          {lowStock.length > 0 ? (
            <div className="px-5 py-4">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-text-muted">
                <PackageX size={14} className="text-icon" aria-hidden="true" />
                {t("dashboard.attention.reorder")}
              </p>
              <ul className="space-y-2">
                {lowStock.map((item) => (
                  <li key={item.productId} className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate text-sm font-semibold text-text">{item.name}</span>
                    <span
                      className={
                        item.quantity <= 0
                          ? "shrink-0 rounded-full bg-danger px-2.5 py-0.5 text-xs font-bold text-white"
                          : "shrink-0 rounded-full bg-warning-container px-2.5 py-0.5 text-xs font-bold text-warning"
                      }
                    >
                      {item.quantity <= 0
                        ? t("dashboard.attention.outOfStock")
                        : t("dashboard.attention.leftOf", { quantity: item.quantity, reorder: item.reorderLevel })}
                    </span>
                  </li>
                ))}
              </ul>
              <Link to="/app/inventory" className="mt-3 inline-block text-sm font-semibold text-primary hover:underline">
                {t("dashboard.attention.openInventory")}
              </Link>
            </div>
          ) : null}

          {pendingOrders > 0 ? (
            <Link
              to="/app/sales"
              className="flex items-center gap-3 px-5 py-4 outline-none transition-colors hover:bg-surface-muted focus-visible:bg-surface-muted"
            >
              <ClipboardList size={18} strokeWidth={1.75} className="shrink-0 text-icon" aria-hidden="true" />
              <span className="flex-1 text-sm font-semibold text-text">
                {t("dashboard.attention.pendingOrders", { count: pendingOrders })}
              </span>
              <span className="text-sm font-semibold text-primary">{t("dashboard.attention.view")}</span>
            </Link>
          ) : null}
        </div>
      )}
    </section>
  );
}
