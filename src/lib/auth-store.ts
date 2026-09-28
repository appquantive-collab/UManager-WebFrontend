import { create } from "zustand";

export type UserRole = "SUPER_ADMIN" | "OWNER" | "MANAGER" | "SALESMAN" | "WAREHOUSE_STAFF";

export interface AuthUser {
  userId: string;
  tenantId: string | null;
  role: UserRole;
  name: string;
  email: string;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  isHydrated: boolean;
  setSession: (session: { accessToken: string; refreshToken: string; user: AuthUser }) => void;
  setAccessToken: (accessToken: string) => void;
  updateUser: (patch: Partial<AuthUser>) => void;
  clearSession: () => void;
}

const STORAGE_KEY = "umanager.auth";

function loadPersisted(): Pick<AuthState, "accessToken" | "refreshToken" | "user"> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { accessToken: null, refreshToken: null, user: null };
    return JSON.parse(raw);
  } catch {
    return { accessToken: null, refreshToken: null, user: null };
  }
}

function persist(state: Pick<AuthState, "accessToken" | "refreshToken" | "user">) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore storage failures (private browsing, quota, etc.)
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  ...loadPersisted(),
  isHydrated: true,
  setSession: (session) => {
    persist(session);
    set({ ...session });
  },
  setAccessToken: (accessToken) => {
    const next = { accessToken, refreshToken: get().refreshToken, user: get().user };
    persist(next);
    set({ accessToken });
  },
  updateUser: (patch) => {
    const currentUser = get().user;
    if (!currentUser) return;
    const user = { ...currentUser, ...patch };
    const next = { accessToken: get().accessToken, refreshToken: get().refreshToken, user };
    persist(next);
    set({ user });
  },
  clearSession: () => {
    localStorage.removeItem(STORAGE_KEY);
    set({ accessToken: null, refreshToken: null, user: null });
  },
}));
