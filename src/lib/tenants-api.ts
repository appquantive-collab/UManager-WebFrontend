import { apiFetch } from "./api";
import type {
  AiDashboardLayout,
  BusinessCategory,
  BusinessGoal,
  BusinessOnboarding,
  CustomerType,
  OrderVolume,
} from "./auth-api";

export interface OnboardingInput {
  category: BusinessCategory;
  customerType: CustomerType;
  orderVolume: OrderVolume;
  warehouseCount: number;
  staffCount: number;
  painPoints?: string;
  goals: BusinessGoal[];
}

export function saveOnboarding(input: OnboardingInput): Promise<{ onboarding: BusinessOnboarding }> {
  return apiFetch("/tenants/onboarding", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function personalizeDashboard(): Promise<{ aiDashboardLayout: AiDashboardLayout }> {
  return apiFetch("/tenants/personalize-dashboard", {
    method: "POST",
  });
}
