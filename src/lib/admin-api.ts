import { adminFetch as apiFetch } from "./admin-session";
import type { PlanState } from "./auth-api";
import type { UserRole } from "./auth-store";

// The founder's console (VoiceMunshi team only): every business and every login.

export interface AdminOverview {
  businesses: { total: number; today: number; week: number; trial: number; paid: number; expired: number; suspended: number };
  users: { total: number; activeWeek: number };
  ai: { tokens: number; calls: number };
  /** Sign-ups per day, last 14 days, oldest first. */
  signups: { date: string; count: number }[];
  recent: { tenantId: string; businessName: string; ownerName: string | null; createdAt: string; status: "trial" | "active" | "expired" | "suspended" }[];
}

export interface AdminBusinessRow {
  tenantId: string;
  businessName: string;
  category: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  ownerPhone: string | null;
  users: number;
  createdAt: string;
  lastSeenAt: string | null;
  suspended: boolean;
  state: PlanState;
  aiTokensUsed: number;
  aiTokenLimitOverride: number | null;
}

export interface AdminUserRow {
  userId: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: UserRole;
  isActive: boolean;
  lastSeenAt: string | null;
  createdAt: string;
  tenantId?: string | null;
  businessName?: string | null;
  businessSuspended?: boolean;
  platformAdmin: boolean;
}

export interface AdminBusinessDetail {
  tenantId: string;
  businessName: string;
  phone: string | null;
  gstin: string | null;
  address: string | null;
  createdAt: string;
  suspended: boolean;
  state: PlanState;
  aiTokenLimitOverride: number | null;
  setup: {
    completed: boolean;
    description: string | null;
    category: string | null;
    template: string | null;
    trade: { buyUnit: string; sellUnit: string; buyUnits?: string[]; sellUnits?: string[] } | null;
  };
  counts: { products: number; customers: number; suppliers: number; purchases: number; bills: number; salesTotal: number };
  aiUsage: { month: string; tokens: number; calls: number }[];
  payments: { plan: string; period: string | null; days: number | null; amount: number; method: string; status: string; note: string | null; paidAt: string | null; createdAt: string }[];
  users: AdminUserRow[];
}

export type BusinessFilter = "all" | "trial" | "paid" | "expired" | "suspended";

export function getAdminOverview(): Promise<AdminOverview> {
  return apiFetch("/admin/overview");
}

export function listAdminBusinesses(q: string, filter: BusinessFilter): Promise<AdminBusinessRow[]> {
  return apiFetch(`/admin/businesses?q=${encodeURIComponent(q)}&filter=${filter}`);
}

export function getAdminBusiness(tenantId: string): Promise<AdminBusinessDetail> {
  return apiFetch(`/admin/businesses/${tenantId}`);
}

/** Suspend / un-suspend, or set this business's monthly AI tokens (null = the plan's). */
export function updateAdminBusiness(tenantId: string, patch: { suspended?: boolean; aiTokenLimit?: number | null }): Promise<{ suspended: boolean; aiTokenLimitOverride: number | null }> {
  return apiFetch(`/admin/businesses/${tenantId}`, { method: "PATCH", body: JSON.stringify(patch) });
}

export function listAdminUsers(q: string): Promise<AdminUserRow[]> {
  return apiFetch(`/admin/users?q=${encodeURIComponent(q)}`);
}

export function setAdminUserActive(userId: string, isActive: boolean): Promise<{ userId: string; isActive: boolean }> {
  return apiFetch(`/admin/users/${userId}`, { method: "PATCH", body: JSON.stringify({ isActive }) });
}

// ---------- Reports ----------

export type AiKind = "chat" | "ask" | "order_reading" | "dashboard" | "setup" | "stt" | "stt_live" | "stt_cleanup" | "tts" | "pre_login";

export interface Pricing {
  usdToInr: number;
  tokens: Record<string, { input: number; cachedInput: number; output: number }>;
  whisperPerHourUsd: Record<string, number>;
  whisperMinSeconds: number;
  sarvamPerMinuteInr: number;
  /** Sarvam voice: INR per 1,000 characters, by model. */
  sarvamTtsPer1kInr: Record<string, number>;
}

export interface AdminCosts {
  days: number;
  pricing: Pricing;
  totals: { rangeInr: number; rangeCalls: number; thisMonthInr: number; thisMonthEstimatedInr: number; lastMonthInr: number; perBusinessInr: number; preLoginInr: number };
  byDay: { day: string; inr: number; calls: number }[];
  byKind: { kind: AiKind; inr: number; calls: number; tokens: number; audioMinutes: number }[];
  byModel: { provider: string; model: string; inr: number; calls: number; inputTokens: number; cachedTokens: number; outputTokens: number; audioMinutes: number }[];
  topBusinesses: { tenantId: string; businessName: string; inr: number; calls: number }[];
}

export interface AdminGrowth {
  weekly: { week: string; signups: number; activeBusinesses: number; bills: number; gmv: number }[];
  revenue: { month: string; inr: number; payments: number }[];
  totals: { businesses: number; paidEver: number; trialOver: number; conversionPct: number; revenueAllTime: number };
  adoption: { key: "setup" | "bills" | "gstBills" | "purchases" | "munshiChat" | "voice" | "team"; count: number; pct: number }[];
}

export interface BusinessActivity {
  daily: { day: string; bills: number; sales: number; purchases: number }[];
  totals30: { bills: number; sales: number; purchases: number; activeDays: number };
  topItems: { name: string; qty: number; unit: string; amount: number }[];
  recentBills: { invoiceNumber: string; customer: string | null; total: number; paid: number; paymentStatus: string; cancelled: boolean; billType: string; createdAt: string }[];
  recentPurchases: { purchaseNumber: string; supplier: string | null; total: number; purchasedAt: string }[];
  ai: { thisMonthInr: number; estimatedInr: number; byKind: { kind: AiKind; inr: number; calls: number }[]; byMonth: { month: string; inr: number; estimated: boolean }[] };
}

export function getAdminCosts(days: number): Promise<AdminCosts> {
  return apiFetch(`/admin/costs?days=${days}`);
}

export function getAdminGrowth(): Promise<AdminGrowth> {
  return apiFetch("/admin/growth");
}

export function getBusinessActivity(tenantId: string): Promise<BusinessActivity> {
  return apiFetch(`/admin/businesses/${tenantId}/activity`);
}

/** This month's AI cost in ₹ per business id. */
export function getCostsByBusiness(): Promise<Record<string, number>> {
  return apiFetch("/admin/costs/by-business");
}

export function getPricing(): Promise<{ pricing: Pricing; defaults: Pricing }> {
  return apiFetch("/admin/pricing");
}

export function savePricing(pricing: Pricing): Promise<{ pricing: Pricing }> {
  return apiFetch("/admin/pricing", { method: "PUT", body: JSON.stringify(pricing) });
}

// ---------- Permanent delete (cannot be undone; the name must be typed) ----------

export function deleteAdminBusiness(tenantId: string, confirmName: string): Promise<{ businessName: string; removed: Record<string, number> }> {
  return apiFetch(`/admin/businesses/${tenantId}`, { method: "DELETE", body: JSON.stringify({ confirmName }) });
}

/** withBusiness: the user owns a business → it and all its data go too. */
export function deleteAdminUser(userId: string, confirmName: string, withBusiness: boolean): Promise<{ deleted: "user" | "business" }> {
  return apiFetch(`/admin/users/${userId}`, { method: "DELETE", body: JSON.stringify({ confirmName, withBusiness }) });
}
