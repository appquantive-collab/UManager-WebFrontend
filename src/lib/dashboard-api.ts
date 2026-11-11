import { apiFetch } from "./api";

export interface DashboardSummary {
  todaySales: number;
  todayOrderCount: number;
  yesterdaySales: number;
  salesChangePercent: number | null;
  monthSales: number;
  receivables: number;
  overdueInvoiceCount: number;
  overdueCustomerCount: number;
  topOverdueCustomerName: string | null;
  topOverdueAmount: number;
  inventoryValue: number;
  totalSkus: number;
  salesTrend: { date?: string; day: string; sales: number }[];
  lowStockCount: number;
  lowStockItems: string[];
  // Newer fields: optional so the app copes with an older backend for a moment during deploys.
  lowStockDetails?: { productId: string; name: string; quantity: number; reorderLevel: number }[];
  topDues?: {
    customerId: string;
    name: string;
    phone: string | null;
    due: number;
    invoiceCount: number;
    oldestInvoiceAt: string;
  }[];
  pendingOrderCount?: number;
  weekSales?: number;
  todayPurchases: number;
  payables: number;
  topProducts: { productId: string; name: string; revenue: number; quantity: number }[];
  recentActivity: { id: string; type: "Sale"; description: string; amount: number; time: string }[];
  recentOrders: {
    id: string;
    customerName: string;
    itemCount: number;
    amount: number;
    status: "pending" | "confirmed" | "delivered" | "cancelled";
    createdAt: string;
  }[];
}

export function getDashboardSummary(): Promise<DashboardSummary> {
  return apiFetch("/dashboard/summary");
}
