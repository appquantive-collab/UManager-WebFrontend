import { apiFetch } from "./api";

export type StaffRole = "MANAGER" | "SALESMAN" | "WAREHOUSE_STAFF";
export type PayType = "salary" | "daily_wage";

export interface Department {
  _id: string;
  name: string;
}

export interface Designation {
  _id: string;
  title: string;
}

export interface DaySchedule {
  dayOfWeek: number;
  isDayOff: boolean;
  startTime?: string;
  endTime?: string;
}

export interface StaffMember {
  _id: string;
  name: string;
  phone?: string;
  role: StaffRole;
  departmentId: Department | null;
  designationId: Designation | null;
  weeklySchedule: DaySchedule[];
  payType: PayType;
  monthlySalary?: number;
  dailyWage?: number;
  isActive: boolean;
  createdAt: string;
}

export interface CreateStaffInput {
  name: string;
  phone?: string;
  role: StaffRole;
  departmentId?: string;
  designationId?: string;
  weeklySchedule?: DaySchedule[];
  payType: PayType;
  monthlySalary?: number;
  dailyWage?: number;
}

export interface UpdateStaffInput {
  name?: string;
  phone?: string;
  role?: StaffRole;
  departmentId?: string | null;
  designationId?: string | null;
  weeklySchedule?: DaySchedule[];
  payType?: PayType;
  monthlySalary?: number;
  dailyWage?: number;
  isActive?: boolean;
}

export function listStaff(): Promise<StaffMember[]> {
  return apiFetch("/staff");
}

export function createStaffMember(input: CreateStaffInput): Promise<StaffMember> {
  return apiFetch("/staff", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateStaffMember(id: string, input: UpdateStaffInput): Promise<StaffMember> {
  return apiFetch(`/staff/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function listDepartments(): Promise<Department[]> {
  return apiFetch("/staff/departments");
}

export function createDepartment(name: string): Promise<Department> {
  return apiFetch("/staff/departments", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export function listDesignations(): Promise<Designation[]> {
  return apiFetch("/staff/designations");
}

export function createDesignation(title: string): Promise<Designation> {
  return apiFetch("/staff/designations", {
    method: "POST",
    body: JSON.stringify({ title }),
  });
}
