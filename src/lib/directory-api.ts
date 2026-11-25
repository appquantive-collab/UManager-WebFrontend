import { apiFetch } from "./api";

/** Another business on VoiceMunshi (what the directory search shows). */
export interface DirectoryBusiness {
  tenantId: string;
  businessName: string;
  businessType: string;
  place: string;
  stateCode: string;
  hasGstin: boolean;
  /** e.g. 98••••••11 — the full number is only saved when you add them. */
  phoneMasked: string | null;
  /** Has a mobile number, so it can be saved and chatted with. */
  reachable: boolean;
  saved: { customerId: string | null; supplierId: string | null };
  conversationId: string | null;
}

export type AddAs = "customer" | "supplier" | "both";

export const searchDirectory = (q: string) => apiFetch<DirectoryBusiness[]>(`/directory?q=${encodeURIComponent(q)}`);

export const addFromDirectory = (tenantId: string, as: AddAs) =>
  apiFetch<{ customerId: string | null; supplierId: string | null; addedCustomer: boolean; addedSupplier: boolean }>(`/directory/${tenantId}/add`, {
    method: "POST",
    body: JSON.stringify({ as }),
  });
