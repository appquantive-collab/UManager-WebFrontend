import { apiFetch } from "./api";
import type { BillingPeriod, PlanKey, PlanState } from "./auth-api";

export type ProFeature = "batch" | "serial" | "variants" | "orderReading" | "aiInsights" | "import" | "gstExport";

export interface PlanPrice {
  period: BillingPeriod;
  months: number;
  discountPercent: number;
  /** Rupees for the whole period. */
  price: number;
  /** Monthly price × months, before discount. */
  fullPrice: number;
}

export interface PlanInfo {
  key: PlanKey;
  monthlyPrice: number;
  aiTokensPerMonth: number;
  proFeatures: boolean;
  prices: PlanPrice[];
}

export interface PriceList {
  trialDays: number;
  proFeatures: ProFeature[];
  plans: PlanInfo[];
}

/** Same numbers as backend modules/billing/plans.ts — shown until the server's list arrives. */
export const FALLBACK_PRICES: PriceList = {
  trialDays: 14,
  proFeatures: ["batch", "serial", "variants", "orderReading", "aiInsights", "import", "gstExport"],
  plans: [
    {
      key: "basic",
      monthlyPrice: 999,
      aiTokensPerMonth: 2000,
      proFeatures: false,
      prices: [
        { period: "monthly", months: 1, discountPercent: 0, price: 999, fullPrice: 999 },
        { period: "quarterly", months: 3, discountPercent: 20, price: 2398, fullPrice: 2997 },
        { period: "annual", months: 12, discountPercent: 40, price: 7193, fullPrice: 11988 },
      ],
    },
    {
      key: "pro",
      monthlyPrice: 2999,
      aiTokensPerMonth: 20000,
      proFeatures: true,
      prices: [
        { period: "monthly", months: 1, discountPercent: 0, price: 2999, fullPrice: 2999 },
        { period: "quarterly", months: 3, discountPercent: 20, price: 7198, fullPrice: 8997 },
        { period: "annual", months: 12, discountPercent: 40, price: 21593, fullPrice: 35988 },
      ],
    },
  ],
};

export interface BillingPayment {
  id: string;
  plan: PlanKey;
  period: BillingPeriod | null;
  days: number | null;
  amount: number;
  method: "razorpay" | "manual";
  note: string | null;
  paidAt: string | null;
  periodStart: string | null;
  periodEnd: string | null;
}

export interface BillingOverview extends PriceList {
  state: PlanState;
  usage: { month: string; used: number; calls: number; limit: number };
  payments: BillingPayment[];
  /** Razorpay keys are set on the server. */
  onlinePayments: boolean;
}

export function getPriceList(): Promise<PriceList> {
  return apiFetch<PriceList>("/billing/plans");
}

export function getBilling(): Promise<BillingOverview> {
  return apiFetch<BillingOverview>("/billing");
}

export interface CheckoutOrder {
  keyId: string;
  orderId: string;
  /** Paise. */
  amount: number;
  currency: string;
  businessName: string;
  prefill: { name: string; email: string; contact: string };
}

export function startCheckout(input: { plan: PlanKey; period: BillingPeriod }): Promise<CheckoutOrder> {
  return apiFetch<CheckoutOrder>("/billing/checkout", { method: "POST", body: JSON.stringify(input) });
}

export function verifyPayment(input: { orderId: string; paymentId: string; signature: string }): Promise<{ state: PlanState }> {
  return apiFetch<{ state: PlanState }>("/billing/verify", { method: "POST", body: JSON.stringify(input) });
}

// ---------- SethSathi team ----------

export interface AdminTenantRow {
  tenantId: string;
  businessName: string;
  ownerEmail: string;
  phone: string | null;
  createdAt: string;
  state: PlanState;
  aiTokensUsed: number;
}

export function listAllBusinesses(q: string): Promise<AdminTenantRow[]> {
  return apiFetch<AdminTenantRow[]>(`/billing/admin/tenants?q=${encodeURIComponent(q)}`);
}

export function grantPlan(input: {
  tenantId: string;
  plan: PlanKey;
  period?: BillingPeriod;
  days?: number;
  amount: number;
  note?: string;
}): Promise<{ state: PlanState }> {
  return apiFetch<{ state: PlanState }>("/billing/admin/grant", { method: "POST", body: JSON.stringify(input) });
}
