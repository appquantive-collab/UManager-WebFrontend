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
} from "lucide-react";

export interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
}

// Mirrors the Tenant Admin Navigation structure defined in CLAUDE.md section 11.
export const tenantNav: NavItem[] = [
  { label: "Dashboard", path: "/", icon: LayoutDashboard },
  { label: "Sales", path: "/sales", icon: ShoppingCart },
  { label: "Purchases", path: "/purchases", icon: Truck },
  { label: "Inventory", path: "/inventory", icon: Package },
  { label: "Customers", path: "/customers", icon: Users },
  { label: "Suppliers", path: "/suppliers", icon: Building2 },
  { label: "Warehouses", path: "/warehouses", icon: Warehouse },
  { label: "Reports", path: "/reports", icon: BarChart3 },
  { label: "AI", path: "/ai", icon: Sparkles },
  { label: "Staff", path: "/staff", icon: UserCog },
  { label: "Settings", path: "/settings", icon: Settings },
];

export const inventorySubNav: NavItem[] = [
  { label: "Products", path: "/inventory", icon: Boxes },
];
