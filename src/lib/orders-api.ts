import { apiFetch } from "./api";

export interface ParsePreviewItem {
  productId: string | null;
  productName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  isNewProduct: boolean;
}

export interface ParsePreview {
  partyName: string | null;
  matchedCustomers: { id: string; name: string; phone?: string }[];
  items: ParsePreviewItem[];
}

export function parseOrderText(text: string): Promise<ParsePreview> {
  return apiFetch("/orders/parse", {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}

export interface OrderLineItemInput {
  productId?: string;
  productName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  isNewProduct: boolean;
}

export interface CreateOrderInput {
  customerId: string;
  items: OrderLineItemInput[];
  notes?: string;
  source: "manual" | "ai_parsed";
  rawText?: string;
}

export interface Order {
  _id: string;
  tenantId: string;
  customerId: { _id: string; name: string; phone?: string } | string;
  items: {
    productId: string;
    productName: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    wasAutoCreated: boolean;
  }[];
  totalAmount: number;
  status: "pending" | "confirmed" | "delivered" | "cancelled";
  source: "manual" | "ai_parsed";
  rawText?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export function createOrder(input: CreateOrderInput): Promise<Order> {
  return apiFetch("/orders", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function listOrders(options?: { billable?: boolean }): Promise<Order[]> {
  const qs = options?.billable ? "?billable=true" : "";
  return apiFetch(`/orders${qs}`);
}
