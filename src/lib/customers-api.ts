import { apiFetch } from "./api";

export interface Customer {
  _id: string;
  tenantId: string;
  name: string;
  phone?: string;
  creditLimit: number;
  isActive: boolean;
  kind?: "person" | "business";
  email?: string;
  gstin?: string;
  /** Only the last 4 digits ever come back from the server. */
  aadhaarLast4?: string;
  address?: string;
  stateCode?: string;
  isWalkIn?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerListItem {
  _id: string;
  name: string;
  phone?: string;
  creditLimit: number;
  isActive: boolean;
  kind?: "person" | "business";
  email?: string;
  gstin?: string;
  aadhaarLast4?: string;
  address?: string;
  stateCode?: string;
  isWalkIn?: boolean;
  totalPurchases: number;
  outstanding: number;
  lastPurchaseAt: string | null;
  createdAt: string;
}

export interface CreateCustomerInput {
  name: string;
  kind?: "person" | "business";
  phone?: string;
  email?: string;
  creditLimit?: number;
  gstin?: string;
  /** 12 digits; "" removes it. Sent only when typed. */
  aadhaar?: string;
  address?: string;
  stateCode?: string;
}

export interface CustomerPortfolio {
  customer: {
    _id: string;
    name: string;
    phone?: string;
    creditLimit: number;
    isActive: boolean;
  kind?: "person" | "business";
  email?: string;
  gstin?: string;
  aadhaarLast4?: string;
  address?: string;
  stateCode?: string;
  isWalkIn?: boolean;
    createdAt: string;
  };
  stats: {
    totalPurchases: number;
    totalPaid: number;
    outstanding: number;
    totalOrders: number;
    pendingOrders: number;
    totalInvoices: number;
    lastPurchaseAt: string | null;
  };
  orders: Array<{
    _id: string;
    itemCount: number;
    totalAmount: number;
    status: string;
    source: string;
    createdAt: string;
  }>;
  invoices: Array<{
    _id: string;
    invoiceNumber: string;
    billType: string;
    totalAmount: number;
    amountPaid: number;
    paymentStatus: string;
    createdAt: string;
  }>;
  payments: Array<{
    invoiceId: string;
    invoiceNumber: string;
    amount: number;
    method: string;
    paidAt: string;
    note?: string;
  }>;
}

export function listCustomers(query?: string): Promise<CustomerListItem[]> {
  const qs = query ? `?q=${encodeURIComponent(query)}` : "";
  return apiFetch(`/customers${qs}`);
}

export function getCustomerPortfolio(id: string): Promise<CustomerPortfolio> {
  return apiFetch(`/customers/${id}/portfolio`);
}

export function createCustomer(input: CreateCustomerInput): Promise<Customer> {
  return apiFetch("/customers", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateCustomer(id: string, input: Partial<CreateCustomerInput>): Promise<Customer> {
  return apiFetch(`/customers/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}
