import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Package,
  Boxes,
  ShoppingCart,
  Truck,
  Users,
  Building2,
  Warehouse,
  BarChart3,
  Sparkles,
  UserCog,
  Settings,
  Receipt,
} from "lucide-react";

export interface NavItem {
  labelKey: string;
  path: string;
  icon: LucideIcon;
}

// Mirrors the Tenant Admin Navigation structure defined in CLAUDE.md section 11.
// All paths live under /app — the authenticated tenant admin shell — since "/"
// is the public marketing landing page. `labelKey` resolves against the `nav`
// namespace in src/locales/*.json via useTranslation().
export const tenantNav: NavItem[] = [
  { labelKey: "nav.dashboard", path: "/app", icon: LayoutDashboard },
  { labelKey: "nav.sales", path: "/app/sales", icon: ShoppingCart },
  { labelKey: "nav.purchases", path: "/app/purchases", icon: Truck },
  { labelKey: "nav.inventory", path: "/app/inventory", icon: Package },
  { labelKey: "nav.customers", path: "/app/customers", icon: Users },
  { labelKey: "nav.suppliers", path: "/app/suppliers", icon: Building2 },
  { labelKey: "nav.warehouses", path: "/app/warehouses", icon: Warehouse },
  { labelKey: "nav.reports", path: "/app/reports", icon: BarChart3 },
  { labelKey: "nav.ai", path: "/app/ai", icon: Sparkles },
  { labelKey: "nav.staff", path: "/app/staff", icon: UserCog },
  { labelKey: "nav.settings", path: "/app/settings", icon: Settings },
];

export const inventorySubNav: NavItem[] = [
  { labelKey: "nav.products", path: "/app/inventory", icon: Boxes },
];

// Condensed set for the mobile bottom bar — the full nav lives in the drawer.
export const mobileBottomNav: NavItem[] = [
  { labelKey: "nav.home", path: "/app", icon: LayoutDashboard },
  { labelKey: "nav.sales", path: "/app/sales", icon: Receipt },
  { labelKey: "nav.stock", path: "/app/inventory", icon: Package },
  { labelKey: "nav.staff", path: "/app/staff", icon: UserCog },
];
