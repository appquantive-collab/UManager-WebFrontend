import { apiFetch } from "./api";

export type TeamRole = "MANAGER" | "SALESMAN" | "WAREHOUSE_STAFF";

export interface TeamMember {
  _id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: "OWNER" | "SUPER_ADMIN" | TeamRole;
  isActive: boolean;
  createdAt: string;
}

export interface AuditEntry {
  _id: string;
  userId: string;
  userName: string;
  action: string;
  summary: string;
  amount?: number;
  entityId?: string;
  createdAt: string;
}

export function listTeam(): Promise<TeamMember[]> {
  return apiFetch("/team");
}

export function addTeamMember(input: { name: string; role: TeamRole; phone?: string; email?: string; password?: string }): Promise<TeamMember> {
  return apiFetch("/team", { method: "POST", body: JSON.stringify(input) });
}

export function updateTeamMember(id: string, input: { role?: TeamRole; isActive?: boolean; password?: string }): Promise<TeamMember> {
  return apiFetch(`/team/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function listAudit(params: { before?: string; userId?: string; action?: string } = {}): Promise<AuditEntry[]> {
  const entries = Object.entries(params).filter(([, v]) => Boolean(v)) as [string, string][];
  const qs = new URLSearchParams(entries).toString();
  return apiFetch(`/audit${qs ? `?${qs}` : ""}`);
}
