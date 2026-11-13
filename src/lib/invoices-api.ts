import { apiFetch } from "./api";

export type PaymentMethod = "cash" | "upi" | "bank_transfer" | "cheque" | "credit" | "other" | "credit_note";
export type InvoicePaymentStatus = "unpaid" | "partial" | "paid";
export type BillType = "gst" | "record";

export interface InvoiceLineItem {
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  gstPercent: number;
  hsn?: string;
  discountPercent?: number;
  lineSubtotal: number;
  lineTax: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
  lineTotal: number;
  orderId?: string;
  serials?: string[];
}

export interface PartySnapshot {
  name?: string;
  phone?: string;
  gstin?: string;
  /** Buyer: last 4 Aadhaar digits (printed masked). */
  aadhaarLast4?: string;
  address?: string;
  stateCode?: string;
}

export interface SellerSnapshot extends PartySnapshot {
  upiId?: string;
  bankName?: string;
  bankAccount?: string;
  bankIfsc?: string;
  terms?: string;
}

export interface Invoice {
  _id: string;
  orderIds: string[];
  customerId: { _id: string; name: string; phone?: string; aadhaarLast4?: string } | string;
  invoiceNumber: string;
  billType: BillType;
  /** Missing on bills made before cancelling existed (= active). */
  status?: "active" | "cancelled";
  items: InvoiceLineItem[];
  subtotal: number;
  discountTotal?: number;
  taxTotal: number;
  cgstTotal?: number;
  sgstTotal?: number;
  igstTotal?: number;
  roundOff?: number;
  totalAmount: number;
  amountPaid: number;
  paymentStatus: InvoicePaymentStatus;
  payments: { amount: number; method: PaymentMethod; paidAt: string; note?: string }[];
  isInterState?: boolean;
  seller?: SellerSnapshot;
  buyer?: PartySnapshot;
  dueDate?: string;
  cancelledAt?: string;
  cancelReason?: string;
  /** Hidden from the bill list; still counts in accounts. */
  archivedAt?: string | null;
  editedAt?: string | null;
  createdAt: string;
}

export const isArchived = (invoice: Pick<Invoice, "archivedAt">) => Boolean(invoice.archivedAt);

export const isCancelled = (invoice: Pick<Invoice, "status">) => invoice.status === "cancelled";

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
  orderId?: string;
  productId?: string;
  productName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  discountPercent?: number;
  /** GST % for this line on a GST bill (else the item's saved rate). */
  gstPercent?: number;
  serials?: string[];
}

export interface CreateBillInput {
  /** Leave out for a walk-in (counter) sale. */
  customerId?: string;
  orderIds: string[];
  items: BillLineItemInput[];
  billType: BillType;
  /** Own bill number; left out → next in the series. */
  invoiceNumber?: string;
  roundOff?: boolean;
  allowShortStock?: boolean;
  allowOverCreditLimit?: boolean;
  /** Money received with the bill. Counter sales without it are taken as paid in cash. */
  payment?: { amount: number; method: Exclude<PaymentMethod, "credit_note"> };
}

/** Sent back with a 409 when stock is short (code INSUFFICIENT_STOCK). */
export interface StockShortage {
  productId: string;
  productName: string;
  unit: string;
  requested: number;
  available: number;
}

/** Sent back with a 409 when the bill crosses the customer's limit (code CREDIT_LIMIT). */
export interface CreditLimitDetails {
  creditLimit: number;
  outstanding: number;
  billTotal: number;
  afterBill: number;
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

export function cancelBill(invoiceId: string, reason?: string): Promise<Invoice> {
  return apiFetch(`/invoices/${invoiceId}/cancel`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export function getNextBillNumber(): Promise<{ invoiceNumber: string }> {
  return apiFetch("/invoices/next-number");
}

/** Change a bill's items, rates, GST, discount, type or number (owner/manager). */
export function editBill(invoiceId: string, input: Omit<CreateBillInput, "customerId" | "orderIds" | "payment">): Promise<Invoice> {
  return apiFetch(`/invoices/${invoiceId}`, { method: "PUT", body: JSON.stringify(input) });
}

export function renumberBill(invoiceId: string, invoiceNumber: string): Promise<Invoice> {
  return apiFetch(`/invoices/${invoiceId}/number`, { method: "PATCH", body: JSON.stringify({ invoiceNumber }) });
}

export function archiveBill(invoiceId: string, archived: boolean): Promise<Invoice> {
  return apiFetch(`/invoices/${invoiceId}/archive`, { method: "PATCH", body: JSON.stringify({ archived }) });
}

export function listInvoices(): Promise<Invoice[]> {
  return apiFetch("/invoices");
}

export function getInvoice(id: string): Promise<Invoice> {
  return apiFetch(`/invoices/${id}`);
}
