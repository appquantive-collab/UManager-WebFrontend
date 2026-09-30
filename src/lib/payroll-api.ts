import { apiFetch } from "./api";

export type PayrollStatus = "unpaid" | "paid";

export interface PayrollRecord {
  _id: string;
  staffId: { _id: string; name: string; role: string; payType: string } | string;
  month: string;
  payType: "salary" | "daily_wage";
  presentDays: number;
  halfDays: number;
  absentDays: number;
  leaveDays: number;
  grossAmount: number;
  deductions: number;
  netAmount: number;
  status: PayrollStatus;
  paidAt?: string;
  note?: string;
  createdAt: string;
}

export function listPayroll(query?: { staffId?: string; month?: string }): Promise<PayrollRecord[]> {
  const params = new URLSearchParams();
  if (query?.staffId) params.set("staffId", query.staffId);
  if (query?.month) params.set("month", query.month);
  const qs = params.toString();
  return apiFetch(`/payroll${qs ? `?${qs}` : ""}`);
}

export function generatePayroll(input: { staffId: string; month: string; deductions?: number; note?: string }): Promise<PayrollRecord> {
  return apiFetch("/payroll", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function generatePayrollForAll(month: string): Promise<{ created: PayrollRecord[]; skipped: { staffId: string; name: string; reason: string }[] }> {
  return apiFetch("/payroll/generate-all", {
    method: "POST",
    body: JSON.stringify({ month }),
  });
}

export function updatePayroll(id: string, input: { deductions?: number; note?: string }): Promise<PayrollRecord> {
  return apiFetch(`/payroll/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function recordPayrollPayment(id: string, note?: string): Promise<PayrollRecord> {
  return apiFetch(`/payroll/${id}/pay`, {
    method: "POST",
    body: JSON.stringify({ note }),
  });
}
