import { useAppStore } from "@/store/useAppStore";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

export async function apiFetch<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = useAppStore.getState().staffToken;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    let errMsg = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      if (data?.detail) {
        errMsg = typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail);
      }
    } catch {
      // ignore
    }
    throw new Error(errMsg);
  }

  return res.json();
}

export function buildWsUrl(restaurantId: string, token: string): string {
  const envWs = import.meta.env.VITE_WS_BASE_URL;
  if (envWs) {
    return `${envWs}/ws/${restaurantId}?token=${encodeURIComponent(token)}`;
  }
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/ws/${restaurantId}?token=${encodeURIComponent(token)}`;
}
