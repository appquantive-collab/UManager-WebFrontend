import { apiFetch } from "./api";

export interface Supplier {
  _id: string;
  tenantId: string;
  name: string;
  phone?: string;
  gstin?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSupplierInput {
  name: string;
  phone?: string;
  gstin?: string;
}

export function listSuppliers(query?: string): Promise<Supplier[]> {
  const qs = query ? `?q=${encodeURIComponent(query)}` : "";
  return apiFetch(`/suppliers${qs}`);
}

export function createSupplier(input: CreateSupplierInput): Promise<Supplier> {
  return apiFetch("/suppliers", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
