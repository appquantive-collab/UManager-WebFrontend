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

/** Business details printed on bills. Empty string clears a field. */
export interface BusinessProfile {
  businessName: string;
  phone?: string;
  gstin?: string;
  address?: string;
  stateCode?: string;
  upiId?: string;
  bankName?: string;
  bankAccount?: string;
  bankIfsc?: string;
  invoiceTerms?: string;
}

export function updateBusinessProfile(input: Partial<BusinessProfile>): Promise<BusinessProfile> {
  return apiFetch("/tenants/profile", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}
