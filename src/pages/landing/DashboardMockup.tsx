import { useTranslation } from "react-i18next";
import {
  Bell,
  Boxes,
  LayoutDashboard,
  Package,
  Receipt,
  Search,
  Settings,
  ShoppingCart,
  Sparkles,
  Truck,
  UserCog,
  Users,
  Warehouse,
  Wrench,
} from "lucide-react";

const navItems = [
  { key: "dashboard", icon: LayoutDashboard, active: true },
  { key: "products", icon: Package, active: false },
  { key: "inventory", icon: Boxes, active: false },
  { key: "sales", icon: ShoppingCart, active: false },
  { key: "purchases", icon: Truck, active: false },
  { key: "customers", icon: Users, active: false },
  { key: "suppliers", icon: Receipt, active: false },
  { key: "warehouses", icon: Warehouse, active: false },
  { key: "aiAssistant", icon: Sparkles, active: false },
  { key: "automations", icon: Wrench, active: false },
  { key: "staff", icon: UserCog, active: false },
  { key: "settings", icon: Settings, active: false },
] as const;

const stats = [
  { key: "todaysSales", value: "₹4,82,500", delta: "+12%" },
  { key: "inventoryValue", value: "₹18,20,000", delta: "+3.2%" },
  { key: "receivables", value: "₹3,72,000", delta: "3 overdue" },
  { key: "orders", value: "248", delta: "+18%" },
] as const;

export function DashboardMockup() {
  const { t } = useTranslation();

  return (
    <section className="relative mx-auto -mt-4 max-w-290 px-4 pb-24 sm:pb-32">
      <div
        className="overflow-hidden rounded-[28px] border border-border bg-surface shadow-elevation-3"
        style={{ transform: "perspective(1400px) rotateX(2deg)", transformOrigin: "top center" }}
      >
        <div className="flex">
          {/* Sidebar */}
          <aside className="hidden w-56 shrink-0 border-r border-border bg-surface-muted/60 p-4 sm:block">
            <div className="mb-6 flex items-center gap-2 px-2">
              <img src="/logo.svg" alt="" className="h-7 w-7" />
              <span className="font-headline text-sm font-bold text-text">{t("brand.name")}</span>
            </div>
            <nav className="space-y-1">
              {navItems.map((item) => (
                <div
                  key={item.key}
                  className={
                    item.active
                      ? "flex items-center gap-2.5 rounded-lg bg-primary-container px-3 py-2 text-[13px] font-semibold text-on-primary-container"
                      : "flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-text-muted"
                  }
                >
                  <item.icon size={15} strokeWidth={1.8} />
                  {t(`landing.mockup.nav.${item.key}`)}
                </div>
              ))}
            </nav>
          </aside>

          {/* Main content */}
          <div className="flex min-w-0 flex-1 flex-col">
            {/* Header */}
            <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
              <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-border bg-surface-variant/60 px-3.5 py-2 text-text-muted">
                <Search size={15} className="shrink-0" />
                <span className="truncate text-[13px]">{t("landing.mockup.searchPlaceholder")}</span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-surface-variant/60 text-text-muted">
                  <Bell size={15} />
                  <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-danger" />
                </span>
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-container text-xs font-bold text-primary">
                  RS
                </span>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 space-y-5 p-5">
              <div>
                <h3 className="font-headline text-lg font-bold text-text">{t("landing.mockup.businessOverview")}</h3>
                <p className="text-[13px] text-text-muted">{t("landing.mockup.executiveSummary")}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {stats.map((stat) => (
                  <div key={stat.key} className="rounded-2xl border border-border bg-surface p-4">
                    <div className="text-[11px] font-medium text-text-muted">{t(`landing.mockup.statLabels.${stat.key}`)}</div>
                    <div className="mt-1.5 font-headline text-lg font-bold text-text">{stat.value}</div>
                    <div className="mt-1 text-[11px] font-semibold text-success">{stat.delta}</div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-border bg-surface p-4 sm:col-span-2">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-sm font-semibold text-text">{t("landing.mockup.revenueTrend")}</span>
                    <span className="text-[11px] text-text-muted">{t("landing.mockup.last7Days")}</span>
                  </div>
                  <div className="flex h-24 items-end gap-1.5">
                    {[40, 55, 48, 70, 62, 85, 78].map((h, i) => (
                      <div
                        key={i}
                        className="flex-1 rounded-t-md bg-primary/25"
                        style={{ height: `${h}%`, background: i === 5 ? "var(--color-primary)" : undefined }}
                      />
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl border border-border bg-surface p-4">
                  <span className="text-sm font-semibold text-text">{t("landing.mockup.topProducts")}</span>
                  <div className="mt-3 space-y-2.5">
                    {["Coca-Cola 300ml", "Tata Salt 1kg", "Surf Excel 1kg"].map((name, i) => (
                      <div key={name} className="flex items-center gap-2">
                        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-variant">
                          <span
                            className="block h-full rounded-full bg-primary"
                            style={{ width: `${80 - i * 22}%` }}
                          />
                        </span>
                        <span className="w-24 shrink-0 truncate text-[11px] text-text-muted">{name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
