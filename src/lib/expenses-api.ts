import { apiFetch } from "./api";

export const EXPENSE_CATEGORIES = [
  "rent",
  "salary",
  "electricity",
  "transport",
  "tea_food",
  "repairs",
  "phone_internet",
  "packing",
  "shop_supplies",
  "bank_charges",
  "other",
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
export type ExpenseMethod = "cash" | "upi" | "bank_transfer" | "cheque" | "other";

export interface Expense {
  _id: string;
  category: ExpenseCategory;
  amount: number;
  method: ExpenseMethod;
  note?: string;
  spentAt: string;
  createdAt: string;
}

export function listExpenses(range?: { from?: string; to?: string }): Promise<Expense[]> {
  const qs = new URLSearchParams();
  if (range?.from) qs.set("from", range.from);
  if (range?.to) qs.set("to", range.to);
  const q = qs.toString();
  return apiFetch(`/expenses${q ? `?${q}` : ""}`);
}

export function createExpense(input: {
  category: ExpenseCategory;
  amount: number;
  method: ExpenseMethod;
  note?: string;
  spentAt?: string;
}): Promise<Expense> {
  return apiFetch("/expenses", { method: "POST", body: JSON.stringify(input) });
}

export function deleteExpense(id: string): Promise<void> {
  return apiFetch(`/expenses/${id}`, { method: "DELETE" });
}
