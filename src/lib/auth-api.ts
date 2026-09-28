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
}

export function login(input: LoginInput): Promise<AuthSession> {
  return apiFetch<AuthSession>("/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function loginByPhone(phone: string, password: string): Promise<AuthSession> {
  return apiFetch<AuthSession>("/auth/login-phone", {
    method: "POST",
    body: JSON.stringify({ phone, password }),
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
  | "pharma"
  | "apparel"
  | "auto_parts"
  | "grocery"
  | "hardware"
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
