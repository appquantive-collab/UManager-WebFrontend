import { apiFetch } from "./api";
import type { PaymentMethod } from "./invoices-api";

export interface ReturnableItem {
  productId: string;
  productName: string;
  unit: string;
  billed: number;
  returned: number;
  returnable: number;
  unitPrice: number;
  unitTax: number;
  gstPercent: number;
  serials: string[];
}

export interface SaleReturn {
  _id: string;
  returnNumber: string;
  invoiceId: string;
  invoiceNumber: string;
  customerId: { _id: string; name: string; phone?: string } | string;
  items: { productId: string; productName: string; quantity: number; unit: string; unitPrice: number; lineTotal: number; serials?: string[] }[];
  subtotal: number;
  taxTotal: number;
  totalAmount: number;
  adjustedAmount: number;
  refundAmount: number;
  refundMethod?: PaymentMethod;
  reason?: string;
  createdAt: string;
}

export type RefundMethod = "cash" | "upi" | "bank_transfer" | "cheque" | "other";

export function getReturnable(invoiceId: string): Promise<{ items: ReturnableItem[]; returns: SaleReturn[] }> {
  return apiFetch(`/returns/invoice/${invoiceId}`);
}

export function createReturn(input: {
  invoiceId: string;
  items: { productId: string; quantity: number; serials?: string[] }[];
  refundMethod?: RefundMethod;
  reason?: string;
}): Promise<SaleReturn> {
  return apiFetch("/returns", { method: "POST", body: JSON.stringify(input) });
}

export function listReturns(): Promise<SaleReturn[]> {
  return apiFetch("/returns");
}
