import { apiFetch } from "./api";
import type { PaymentMethod } from "./invoices-api";

export interface Purchase {
  _id: string;
  supplierId: { _id: string; name: string; phone?: string; gstin?: string } | string;
  warehouseId: { _id: string; name: string } | string;
  purchaseNumber: string;
  supplierBillNumber?: string;
  items: {
    productId: string;
    productName: string;
    quantity: number;
    unit: string;
    unitCost: number;
    gstPercent: number;
    lineSubtotal: number;
    lineTax: number;
    lineTotal: number;
  }[];
  subtotal: number;
  taxTotal: number;
  totalAmount: number;
  amountPaid: number;
  paymentStatus: "unpaid" | "partial" | "paid";
  payments: { amount: number; method: PaymentMethod; paidAt: string; note?: string }[];
  purchasedAt: string;
  note?: string;
  createdAt: string;
}

export interface CreatePurchaseInput {
  supplierId: string;
  warehouseId?: string;
  supplierBillNumber?: string;
  purchasedAt?: string;
  note?: string;
  items: {
    productId: string;
    quantity: number;
    unitCost: number;
    gstPercent?: number;
    /** The item's unit or its bigger pack (e.g. "box"). */
    unit?: string;
    batchNo?: string;
    expiryDate?: string;
    serials?: string[];
  }[];
  payment?: { amount: number; method: PaymentMethod };
}

export function listPurchases(): Promise<Purchase[]> {
  return apiFetch("/purchases");
}

export function createPurchase(input: CreatePurchaseInput): Promise<Purchase> {
  return apiFetch("/purchases", { method: "POST", body: JSON.stringify(input) });
}

export function recordPurchasePayment(id: string, input: { amount: number; method: PaymentMethod; note?: string }): Promise<Purchase> {
  return apiFetch(`/purchases/${id}/payments`, { method: "POST", body: JSON.stringify(input) });
}

/** Pill colour per payment status (matches the kit's Tone names). */
export const purchaseStatusTone = { unpaid: "danger", partial: "warning", paid: "success" } as const satisfies Record<
  Purchase["paymentStatus"],
  string
>;

export function supplierOf(purchase: Purchase): { _id: string; name: string; phone?: string } {
  return typeof purchase.supplierId === "string" ? { _id: purchase.supplierId, name: "" } : purchase.supplierId;
}
