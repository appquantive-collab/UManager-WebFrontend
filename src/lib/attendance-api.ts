import { apiFetch } from "./api";

export type AttendanceStatus = "present" | "absent" | "half_day" | "leave";

export interface AttendanceRecord {
  _id: string;
  staffId: { _id: string; name: string; role: string } | string;
  date: string;
  status: AttendanceStatus;
  note?: string;
  createdAt: string;
}

export interface MonthlyAttendanceSummary {
  presentDays: number;
  halfDays: number;
  absentDays: number;
  leaveDays: number;
  totalMarked: number;
}

export function listAttendance(query?: { staffId?: string; date?: string; from?: string; to?: string }): Promise<AttendanceRecord[]> {
  const params = new URLSearchParams();
  if (query?.staffId) params.set("staffId", query.staffId);
  if (query?.date) params.set("date", query.date);
  if (query?.from) params.set("from", query.from);
  if (query?.to) params.set("to", query.to);
  const qs = params.toString();
  return apiFetch(`/attendance${qs ? `?${qs}` : ""}`);
}

export function getMonthlyAttendanceSummary(staffId: string, month: string): Promise<MonthlyAttendanceSummary> {
  return apiFetch(`/attendance/summary/${staffId}/${month}`);
}

export function markAttendance(input: { staffId: string; date: string; status: AttendanceStatus; note?: string }): Promise<AttendanceRecord> {
  return apiFetch("/attendance", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function bulkMarkAttendance(input: {
  date: string;
  entries: { staffId: string; status: AttendanceStatus; note?: string }[];
}): Promise<AttendanceRecord[]> {
  return apiFetch("/attendance/bulk", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
