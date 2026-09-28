import { apiFetch } from "./api";

export interface Customer {
  _id: string;
  tenantId: string;
  name: string;
  phone?: string;
  creditLimit: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCustomerInput {
  name: string;
  phone?: string;
  creditLimit?: number;
}

export function listCustomers(query?: string): Promise<Customer[]> {
  const qs = query ? `?q=${encodeURIComponent(query)}` : "";
  return apiFetch(`/customers${qs}`);
}

export function createCustomer(input: CreateCustomerInput): Promise<Customer> {
  return apiFetch("/customers", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
