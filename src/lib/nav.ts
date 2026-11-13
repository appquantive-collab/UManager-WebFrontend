import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Boxes,
  Building2,
  House,
  LayoutDashboard,
  Package,
  ReceiptIndianRupee,
  Settings,
  ShoppingCart,
  Sparkles,
  Truck,
  UserCog,
  Users,
  UsersRound,
  Wallet,
  Warehouse,
} from "lucide-react";
import type { UserRole } from "./auth-store";
import type { AppFeatures } from "./auth-api";

export interface NavItem {
  labelKey: string;
  path: string;
  icon: LucideIcon;
  /** Staff roles that can't use this page (owner and manager see everything). */
  hiddenFor?: UserRole[];
  /** Shown only when this part of the app is switched on in the business setup. */
  feature?: keyof AppFeatures;
  /** Sidebar section (labels under nav.group.*); items of a group sit together. */
  group?: NavGroup;
}

export type NavGroup = "main" | "sell" | "stock" | "money" | "manage";

/** Whether someone with this role should see a nav entry. */
export function canSee(item: NavItem, role: UserRole | undefined, features?: AppFeatures): boolean {
  if (item.feature && features && !features[item.feature]) return false;
  return !role || !item.hiddenFor?.includes(role);
}

// Mirrors the Tenant Admin Navigation structure defined in CLAUDE.md section 11.
// All paths live under /app — the authenticated tenant admin shell — since "/"
// is the public marketing landing page. `labelKey` resolves against the `nav`
// namespace in src/locales/*.json via useTranslation().
export const tenantNav: NavItem[] = [
  { labelKey: "nav.dashboard", path: "/app", icon: LayoutDashboard, group: "main" },
  { labelKey: "nav.ai", path: "/app/ai", icon: Sparkles, group: "main" },
  { labelKey: "nav.sales", path: "/app/sales", icon: ShoppingCart, hiddenFor: ["WAREHOUSE_STAFF"], group: "sell" },
  { labelKey: "nav.customers", path: "/app/customers", icon: Users, hiddenFor: ["WAREHOUSE_STAFF"], group: "sell" },
  { labelKey: "nav.inventory", path: "/app/inventory", icon: Package, group: "stock" },
  { labelKey: "nav.purchases", path: "/app/purchases", icon: Truck, hiddenFor: ["SALESMAN"], feature: "purchases", group: "stock" },
  { labelKey: "nav.suppliers", path: "/app/suppliers", icon: Building2, hiddenFor: ["SALESMAN"], feature: "purchases", group: "stock" },
  { labelKey: "nav.warehouses", path: "/app/warehouses", icon: Warehouse, feature: "warehouses", group: "stock" },
  { labelKey: "nav.cashbook", path: "/app/cashbook", icon: Wallet, hiddenFor: ["SALESMAN", "WAREHOUSE_STAFF"], feature: "cashbook", group: "money" },
  { labelKey: "nav.reports", path: "/app/reports", icon: BarChart3, hiddenFor: ["SALESMAN", "WAREHOUSE_STAFF"], group: "money" },
  { labelKey: "nav.staff", path: "/app/staff", icon: UserCog, hiddenFor: ["SALESMAN", "WAREHOUSE_STAFF"], feature: "staff", group: "manage" },
  { labelKey: "nav.settings", path: "/app/settings", icon: Settings, group: "manage" },
];

export const inventorySubNav: NavItem[] = [
  { labelKey: "nav.products", path: "/app/inventory", icon: Boxes },
];

// Condensed set for the mobile bottom bar — the full nav lives in the drawer.
export const mobileBottomNav: NavItem[] = [
  { labelKey: "nav.home", path: "/app", icon: House },
  { labelKey: "nav.sales", path: "/app/sales", icon: ReceiptIndianRupee, hiddenFor: ["WAREHOUSE_STAFF"] },
  { labelKey: "nav.stock", path: "/app/inventory", icon: Package },
  { labelKey: "nav.staff", path: "/app/staff", icon: UsersRound, hiddenFor: ["SALESMAN", "WAREHOUSE_STAFF"], feature: "staff" },
];
