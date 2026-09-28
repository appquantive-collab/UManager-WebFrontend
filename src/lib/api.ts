import { useAuthStore } from "./auth-store";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function buildHeaders(token: string | null, extra?: HeadersInit): HeadersInit {
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

async function parseErrorBody(res: Response): Promise<never> {
  const body = await res.json().catch(() => ({}));
  const message =
    typeof body.error === "string" ? body.error : (body.error?.message ?? `Request failed: ${res.status}`);
  throw new ApiError(message, res.status);
}

// Concurrent 401s must share a single refresh call — otherwise every in-flight
// request races to spend the same (single-use) refresh token.
let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  const refreshToken = useAuthStore.getState().refreshToken;
  if (!refreshToken) throw new Error("No refresh token available");

  if (!refreshPromise) {
    refreshPromise = fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("Refresh failed");
        const data = await res.json();
        useAuthStore.getState().setAccessToken(data.accessToken);
        return data.accessToken as string;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = useAuthStore.getState().accessToken;

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: buildHeaders(token, options.headers),
  });

  if (res.status === 401 && path !== "/auth/refresh") {
    try {
      const newToken = await refreshAccessToken();
      const retryRes = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers: buildHeaders(newToken, options.headers),
      });
      if (!retryRes.ok) return parseErrorBody(retryRes);
      if (retryRes.status === 204) return undefined as T;
      return retryRes.json() as Promise<T>;
    } catch {
      useAuthStore.getState().clearSession();
      throw new ApiError("Session expired. Please sign in again.", 401);
    }
  }

  if (!res.ok) return parseErrorBody(res);

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
