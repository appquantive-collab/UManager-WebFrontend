import { create } from "zustand";
import { API_BASE_URL, ApiError } from "./api";

/**
 * The VoiceMunshi team's own session for the founder's console: its own
 * tokens under its own storage key, so signing in or out here never touches a
 * shop login in the same browser (and the other way round).
 */

const STORAGE_KEY = "voicemunshi.admin-session";

interface AdminSessionData {
  accessToken: string | null;
  refreshToken: string | null;
  admin: { name: string; email: string } | null;
}

interface AdminSessionState extends AdminSessionData {
  setSession: (s: { accessToken: string; refreshToken: string; admin: { name: string; email: string } }) => void;
  setAccessToken: (token: string) => void;
  clear: () => void;
}

function load(): AdminSessionData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as AdminSessionData;
  } catch {
    // private mode / bad data: start signed out
  }
  return { accessToken: null, refreshToken: null, admin: null };
}

function save(data: AdminSessionData) {
  try {
    if (data.accessToken) localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // private mode: the session lasts until the tab closes
  }
}

export const useAdminSession = create<AdminSessionState>((set, get) => ({
  ...load(),
  setSession: (s) => {
    save(s);
    set(s);
  },
  setAccessToken: (accessToken) => {
    const next = { accessToken, refreshToken: get().refreshToken, admin: get().admin };
    save(next);
    set({ accessToken });
  },
  clear: () => {
    save({ accessToken: null, refreshToken: null, admin: null });
    set({ accessToken: null, refreshToken: null, admin: null });
  },
}));

let refreshing: Promise<string> | null = null;

async function refreshAdminToken(): Promise<string> {
  const refreshToken = useAdminSession.getState().refreshToken;
  if (!refreshToken) throw new Error("No admin refresh token");
  refreshing ??= fetch(`${API_BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  })
    .then(async (res) => {
      if (!res.ok) throw new Error("Refresh failed");
      const { accessToken } = (await res.json()) as { accessToken: string };
      useAdminSession.getState().setAccessToken(accessToken);
      return accessToken;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

async function toError(res: Response): Promise<never> {
  const body = await res.json().catch(() => ({}));
  const message = typeof body.error === "string" ? body.error : (body.error?.message ?? `Request failed: ${res.status}`);
  // Admin login stopped or no longer an admin: back to the admin sign-in.
  if (res.status === 403 && (body.code === "ACCOUNT_DISABLED" || body.code === "FORBIDDEN")) useAdminSession.getState().clear();
  throw new ApiError(message, res.status, typeof body.code === "string" ? body.code : undefined, undefined, body.details);
}

/** Like apiFetch, but with the admin's token. */
export async function adminFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const send = (token: string | null) =>
    fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
    });

  let res = await send(useAdminSession.getState().accessToken);
  if (res.status === 401) {
    try {
      res = await send(await refreshAdminToken());
    } catch {
      useAdminSession.getState().clear();
      throw new ApiError("Session expired. Please sign in again.", 401);
    }
  }
  if (!res.ok) return toError(res);
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export function adminLogin(email: string, password: string): Promise<{ accessToken: string; refreshToken: string; admin: { name: string; email: string } }> {
  return fetch(`${API_BASE_URL}/admin-auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  }).then(async (res) => (res.ok ? res.json() : toError(res)));
}

export function getAdminMe(): Promise<{ name: string; email: string }> {
  return adminFetch("/admin-auth/me");
}

/** Hear a Sarvam voice (admin only); returns playable audio. */
export async function previewVoice(voice: string): Promise<Blob> {
  const send = (token: string | null) =>
    fetch(`${API_BASE_URL}/billing/admin/voice-preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ voice }),
    });
  let res = await send(useAdminSession.getState().accessToken);
  if (res.status === 401) res = await send(await refreshAdminToken());
  if (!res.ok) return toError(res);
  return res.blob();
}

export function changeAdminPassword(current: string, next: string): Promise<{ ok: true }> {
  return adminFetch("/admin-auth/password", { method: "POST", body: JSON.stringify({ current, next }) });
}
