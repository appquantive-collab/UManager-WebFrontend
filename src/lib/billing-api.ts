import { adminFetch } from "./admin-session";
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
  /** Roughly how many Munshi AI questions the daily allowance covers. */
  aiQuestionsPerDay: number | null;
  /** Tokens a day on the plan (same scale as the usage). */
  aiTokensPerDay: number | null;
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
      aiQuestionsPerDay: 95,
      aiTokensPerDay: 523000,
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
      aiQuestionsPerDay: 490,
      aiTokensPerDay: 2588000,
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
  /** Today's Munshi AI allowance, as percentages (resets at midnight, India time). */
  usage: {
    todayPct: number;
    monthPct: number;
    unlimited: boolean;
    exhausted: boolean;
    resetsAt: string;
    /** One token scale for all AI (chat, speaking, voice): 1 token = one input token of Munshi's main model. */
    todayTokens: number;
    dailyTokens: number;
    remainingTokens: number;
    monthTokens: number;
    monthlyTokens: number;
    todayByUse: { questions: number; speaking: number; voice: number; other: number };
    tokensPerQuestion: number;
    tokensPerSpeechMinute: number;
    remainingQuestions: number;
    remainingSpeechMinutes: number;
  };
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

// ---------- VoiceMunshi team ----------

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
  return adminFetch<AdminTenantRow[]>(`/billing/admin/tenants?q=${encodeURIComponent(q)}`);
}

export function grantPlan(input: {
  tenantId: string;
  plan: PlanKey;
  period?: BillingPeriod;
  days?: number;
  amount: number;
  note?: string;
}): Promise<{ state: PlanState }> {
  return adminFetch<{ state: PlanState }>("/billing/admin/grant", { method: "POST", body: JSON.stringify(input) });
}

/** Which speech-to-text turns recordings into text, for every business (super admin). */
export type SttEngine = "auto" | "sarvam" | "whisper";

export interface PlatformSettings {
  sttEngine: SttEngine;
  /** A Sarvam key is set on the server. */
  sarvamConfigured: boolean;
  /** Not paused after a credits/key error. */
  sarvamAvailable: boolean;
  /** Who speaks Munshi's Hindi/Hinglish replies. */
  ttsEngine: "auto" | "sarvam" | "edge";
  ttsVoice: string;
  sarvamVoiceAvailable: boolean;
  voices: { key: string; label: string; model: string }[];
}

export function getPlatformSettings(): Promise<PlatformSettings> {
  return adminFetch<PlatformSettings>("/billing/admin/settings");
}

export function updatePlatformSettings(input: { sttEngine?: SttEngine; ttsEngine?: PlatformSettings["ttsEngine"]; ttsVoice?: string }): Promise<PlatformSettings> {
  return adminFetch<PlatformSettings>("/billing/admin/settings", { method: "PATCH", body: JSON.stringify(input) });
}
