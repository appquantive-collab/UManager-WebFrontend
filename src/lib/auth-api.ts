import { apiFetch } from "./api";
import type { AuthUser } from "./auth-store";

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  businessName: string;
  businessType: string;
  ownerName: string;
  email: string;
  password: string;
  phone?: string;
  preferredLanguage?: AuthUser["preferredLanguage"];
}

export function login(input: LoginInput): Promise<AuthSession> {
  return apiFetch<AuthSession>("/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

// `code` is only present while the backend has no SMS provider and shows the OTP in-app instead.
export function requestLoginOtp(
  phone: string
): Promise<{ resendAfterSeconds: number; expiresInSeconds: number; code?: string }> {
  return apiFetch("/auth/otp/request", {
    method: "POST",
    body: JSON.stringify({ phone }),
  });
}

export function verifyLoginOtp(phone: string, code: string): Promise<AuthSession> {
  return apiFetch<AuthSession>("/auth/otp/verify", {
    method: "POST",
    body: JSON.stringify({ phone, code }),
  });
}

export function register(input: RegisterInput): Promise<AuthSession> {
  return apiFetch<AuthSession>("/auth/register", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export type BusinessCategory =
  | "fmcg"
  | "electronics"
  | "mobile_accessories"
  | "pharma"
  | "apparel"
  | "footwear"
  | "textiles_fabric"
  | "auto_parts"
  | "two_wheeler_parts"
  | "grocery"
  | "hardware"
  | "sanitary_plumbing"
  | "electrical_goods"
  | "paints_chemicals"
  | "building_materials"
  | "furniture"
  | "musical_instruments"
  | "sports_goods"
  | "toys_games"
  | "stationery_books"
  | "gift_items"
  | "cosmetics_beauty"
  | "jewellery_artificial"
  | "bags_luggage"
  | "kitchenware_utensils"
  | "plastic_goods"
  | "packaging_materials"
  | "confectionery_bakery"
  | "dry_fruits_spices"
  | "tea_coffee"
  | "dairy_products"
  | "agro_seeds_fertilizers"
  | "cattle_feed"
  | "tiles_sanitaryware"
  | "glass_hardware"
  | "computer_it"
  | "printing_stationery"
  | "cleaning_supplies"
  | "fireworks"
  | "readymade_garments"
  | "saree_ethnic_wear"
  | "watches_eyewear"
  | "religious_puja_items"
  | "other";

export type CustomerType = "wholesale" | "retail" | "both";
export type OrderVolume = "lt_100" | "100_500" | "500_2000" | "gt_2000";
export type BusinessGoal =
  | "inventory_tracking"
  | "credit_payments"
  | "multi_warehouse"
  | "staff_management"
  | "ai_insights"
  | "reporting";

export interface BusinessOnboarding {
  completed: boolean;
  category: BusinessCategory | null;
  customerType: CustomerType | null;
  orderVolume: OrderVolume | null;
  warehouseCount: number | null;
  staffCount: number | null;
  painPoints: string | null;
  goals: BusinessGoal[];
  completedAt: string | null;
}

export interface DashboardLayoutSection {
  key: string;
  label: string;
  priority: number;
}

export interface AiDashboardLayout {
  generatedAt: string;
  welcomeMessage: string;
  sections: DashboardLayoutSection[];
  quickActionLabels: Record<string, string>;
}

export interface Profile {
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  role: AuthUser["role"];
  preferredLanguage: AuthUser["preferredLanguage"];
  tenant: {
    tenantId: string;
    businessName: string;
    businessType: string;
    plan: "starter" | "business" | "enterprise";
    status: "trial" | "active" | "suspended";
    currency: string;
    onboarding: BusinessOnboarding;
    aiDashboardLayout: AiDashboardLayout | null;
  } | null;
}

export function getProfile(): Promise<Profile> {
  return apiFetch<Profile>("/auth/me");
}

export function updateProfile(patch: { preferredLanguage?: AuthUser["preferredLanguage"] }): Promise<{
  preferredLanguage: AuthUser["preferredLanguage"];
}> {
  return apiFetch("/auth/me", {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}
