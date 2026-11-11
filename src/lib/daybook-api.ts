import { apiFetch } from "./api";

type ByMethod = Record<string, number>;

export interface Daybook {
  date: string;
  sales: { total: number; count: number };
  returns: { total: number; count: number };
  moneyIn: { sales: ByMethod };
  moneyOut: { suppliers: ByMethod; expenses: ByMethod; refunds: ByMethod; salaries: ByMethod };
  totals: { received: number; paidOut: number };
  expensesByCategory: { category: string; total: number }[];
  cash: { opening: number; openingFrom: string | null; in: number; out: number; expected: number };
  closing: { countedCash: number; difference: number; note?: string; closedAt: string } | null;
}

export function getDaybook(date: string): Promise<Daybook> {
  return apiFetch(`/daybook?date=${date}`);
}

export function closeDay(input: { date: string; countedCash: number; openingCash?: number; note?: string }): Promise<Daybook> {
  return apiFetch("/daybook/close", { method: "POST", body: JSON.stringify(input) });
}

/** Today's date in India time, as YYYY-MM-DD. */
export function todayIst(): string {
  return new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
}
