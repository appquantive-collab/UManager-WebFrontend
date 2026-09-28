import type { BusinessCategory, BusinessGoal, CustomerType, OrderVolume } from "./auth-api";

export const categoryLabels: Record<BusinessCategory, string> = {
  fmcg: "FMCG",
  electronics: "Electronics",
  pharma: "Pharma",
  apparel: "Apparel",
  auto_parts: "Auto Parts",
  grocery: "Grocery",
  hardware: "Hardware",
  other: "Other",
};

export const customerTypeLabels: Record<CustomerType, string> = {
  wholesale: "Wholesale / B2B",
  retail: "Retail",
  both: "Both",
};

export const orderVolumeLabels: Record<OrderVolume, string> = {
  lt_100: "< 100 orders/month",
  "100_500": "100–500 orders/month",
  "500_2000": "500–2,000 orders/month",
  gt_2000: "2,000+ orders/month",
};

export const goalLabels: Record<BusinessGoal, string> = {
  inventory_tracking: "Inventory tracking",
  credit_payments: "Credit & payment collection",
  multi_warehouse: "Multi-warehouse ops",
  staff_management: "Staff & role management",
  ai_insights: "AI-assisted insights",
  reporting: "Reports & analytics",
};
