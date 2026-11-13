import { apiFetch } from "./api";
import type {
  AiDashboardLayout,
  AppFeatures,
  AppSetup,
  BusinessCategory,
  BusinessGoal,
  BusinessOnboarding,
  BusinessRole,
  CustomerType,
  OnlineChannel,
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
  description?: string;
  roles?: BusinessRole[];
  sellsOnline?: OnlineChannel[];
  onlineStoreUrl?: string;
  hasGst?: boolean | null;
  gstin?: string;
  appSetup?: AppSetup;
  starterCategories?: string[];
}

export interface Understanding {
  category: BusinessCategory;
  roles: BusinessRole[];
  needs: { batch: boolean; serial: boolean; variants: boolean; rawMaterials: boolean };
  summary: string;
  source: "ai" | "rules";
}

/** Munshi AI reads "aap kya kaam karte hain" and suggests category, role and needs. */
export function understandBusiness(text: string, language: string): Promise<Understanding> {
  return apiFetch("/tenants/onboarding/understand", { method: "POST", body: JSON.stringify({ text, language }) });
}

export function updateAppSetup(input: { defaultBillType?: "gst" | "record"; features?: Partial<AppFeatures> }): Promise<{ appSetup: AppSetup }> {
  return apiFetch("/tenants/setup", { method: "PATCH", body: JSON.stringify(input) });
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
