const BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${BASE}${path}`, init);
}
