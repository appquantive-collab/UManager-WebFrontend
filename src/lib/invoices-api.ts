import { apiFetch } from "./api";

export type PaymentMethod = "cash" | "upi" | "bank_transfer" | "cheque" | "credit" | "other";
export type InvoicePaymentStatus = "unpaid" | "partial" | "paid";
export type BillType = "gst" | "record";

export interface InvoiceLineItem {
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  gstPercent: number;
  lineSubtotal: number;
  lineTax: number;
  lineTotal: number;
}

export interface Invoice {
  _id: string;
  orderIds: string[];
  customerId: { _id: string; name: string; phone?: string } | string;
  invoiceNumber: string;
  billType: BillType;
  items: InvoiceLineItem[];
  subtotal: number;
  taxTotal: number;
  totalAmount: number;
  amountPaid: number;
  paymentStatus: InvoicePaymentStatus;
  payments: { amount: number; method: PaymentMethod; paidAt: string; note?: string }[];
  createdAt: string;
}

export interface PendingItem {
  orderId: string;
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
}

export function getCustomerPendingItems(customerId: string): Promise<{ items: PendingItem[] }> {
  return apiFetch(`/invoices/pending-items/${customerId}`);
}

export interface BillLineItemInput {
  productId?: string;
  productName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
}

export interface CreateBillInput {
  customerId: string;
  orderIds: string[];
  items: BillLineItemInput[];
  billType: BillType;
}

export function createBill(input: CreateBillInput): Promise<Invoice> {
  return apiFetch("/invoices", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function recordPayment(
  invoiceId: string,
  input: { amount: number; method: PaymentMethod; note?: string }
): Promise<Invoice> {
  return apiFetch(`/invoices/${invoiceId}/payments`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function listInvoices(): Promise<Invoice[]> {
  return apiFetch("/invoices");
}
