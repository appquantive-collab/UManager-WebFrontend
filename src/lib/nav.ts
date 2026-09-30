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
  label: string;
  path: string;
  icon: LucideIcon;
}

// Mirrors the Tenant Admin Navigation structure defined in CLAUDE.md section 11.
// All paths live under /app — the authenticated tenant admin shell — since "/"
// is the public marketing landing page.
export const tenantNav: NavItem[] = [
  { label: "Dashboard", path: "/app", icon: LayoutDashboard },
  { label: "Sales", path: "/app/sales", icon: ShoppingCart },
  { label: "Purchases", path: "/app/purchases", icon: Truck },
  { label: "Inventory", path: "/app/inventory", icon: Package },
  { label: "Customers", path: "/app/customers", icon: Users },
  { label: "Suppliers", path: "/app/suppliers", icon: Building2 },
  { label: "Warehouses", path: "/app/warehouses", icon: Warehouse },
  { label: "Reports", path: "/app/reports", icon: BarChart3 },
  { label: "AI", path: "/app/ai", icon: Sparkles },
  { label: "Staff", path: "/app/staff", icon: UserCog },
  { label: "Settings", path: "/app/settings", icon: Settings },
];

export const inventorySubNav: NavItem[] = [
  { label: "Products", path: "/app/inventory", icon: Boxes },
];

// Condensed set for the mobile bottom bar — the full nav lives in the drawer.
export const mobileBottomNav: NavItem[] = [
  { label: "Home", path: "/app", icon: LayoutDashboard },
  { label: "Sales", path: "/app/sales", icon: Receipt },
  { label: "Stock", path: "/app/inventory", icon: Package },
  { label: "Staff", path: "/app/staff", icon: UserCog },
];
