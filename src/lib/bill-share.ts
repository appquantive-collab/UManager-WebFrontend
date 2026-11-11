import type { Invoice, SellerSnapshot } from "./invoices-api";
import { formatMoney, formatQty } from "./format";

export const billBalance = (invoice: Pick<Invoice, "totalAmount" | "amountPaid">) =>
  Math.max(0, Math.round((invoice.totalAmount - invoice.amountPaid) * 100) / 100);

export function billCustomerName(invoice: Invoice): string {
  if (invoice.buyer?.name) return invoice.buyer.name;
  return typeof invoice.customerId === "string" ? "" : invoice.customerId.name;
}

export function billCustomerPhone(invoice: Invoice): string | undefined {
  if (invoice.buyer?.phone) return invoice.buyer.phone;
  return typeof invoice.customerId === "string" ? undefined : invoice.customerId.phone;
}

/** UPI deep link (works in GPay, PhonePe, Paytm, BHIM) for the amount still due. */
export function upiPayLink(upiId: string, payeeName: string, amount: number, note: string): string {
  const params = new URLSearchParams({ pa: upiId, pn: payeeName, cu: "INR", tn: note });
  if (amount > 0) params.set("am", amount.toFixed(2));
  return `upi://pay?${params.toString()}`;
}

/** Bill as a WhatsApp message: readable on a phone, no attachments needed. */
export function billWhatsappText(invoice: Invoice, seller: SellerSnapshot, labels: {
  bill: string;
  total: string;
  paid: string;
  balance: string;
  payByUpi: string;
  thanks: string;
}): string {
  const lines: string[] = [];
  lines.push(`*${seller.name ?? ""}*`);
  lines.push(`${labels.bill} ${invoice.invoiceNumber} · ${new Date(invoice.createdAt).toLocaleDateString("en-IN")}`);
  lines.push("");
  for (const item of invoice.items) {
    lines.push(`• ${item.productName} — ${formatQty(item.quantity)} ${item.unit} × ${formatMoney(item.unitPrice)} = ${formatMoney(item.lineTotal)}`);
  }
  lines.push("");
  lines.push(`*${labels.total}: ${formatMoney(invoice.totalAmount)}*`);
  const balance = billBalance(invoice);
  if (invoice.amountPaid > 0) lines.push(`${labels.paid}: ${formatMoney(invoice.amountPaid)}`);
  if (balance > 0) {
    lines.push(`*${labels.balance}: ${formatMoney(balance)}*`);
    if (seller.upiId) lines.push(`${labels.payByUpi}: ${seller.upiId}`);
  }
  lines.push("");
  lines.push(labels.thanks);
  return lines.join("\n");
}

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve",
  "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function belowThousand(n: number): string {
  const parts: string[] = [];
  if (n >= 100) {
    parts.push(`${ONES[Math.floor(n / 100)]} Hundred`);
    n %= 100;
  }
  if (n >= 20) {
    parts.push(TENS[Math.floor(n / 10)] + (n % 10 ? ` ${ONES[n % 10]}` : ""));
  } else if (n > 0) {
    parts.push(ONES[n]);
  }
  return parts.join(" ");
}

/** 125050.5 → "Rupees One Lakh Twenty Five Thousand Fifty and Fifty Paise Only" (Indian grouping). */
export function amountInWords(amount: number): string {
  const rupees = Math.floor(Math.abs(amount));
  const paise = Math.round((Math.abs(amount) - rupees) * 100);
  const words: string[] = [];
  let n = rupees;
  const crore = Math.floor(n / 1e7);
  n %= 1e7;
  const lakh = Math.floor(n / 1e5);
  n %= 1e5;
  const thousand = Math.floor(n / 1e3);
  n %= 1e3;
  if (crore) words.push(`${crore >= 1000 ? amountInWords(crore).replace(/^Rupees |\s*Only$/g, "") : belowThousand(crore)} Crore`);
  if (lakh) words.push(`${belowThousand(lakh)} Lakh`);
  if (thousand) words.push(`${belowThousand(thousand)} Thousand`);
  if (n) words.push(belowThousand(n));
  const rupeeWords = words.length ? words.join(" ") : "Zero";
  return `Rupees ${rupeeWords}${paise ? ` and ${belowThousand(paise)} Paise` : ""} Only`;
}
