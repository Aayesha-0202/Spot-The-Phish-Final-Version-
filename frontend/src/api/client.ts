/**
 * Thin fetch wrapper for the backend API.
 * Uses a relative base ("/api") so the Vite dev proxy (dev) and nginx (prod)
 * both route requests to the backend without CORS gymnastics.
 *
 * Auth uses httpOnly cookies — every call sends credentials:'include', and a
 * 401 triggers a single transparent /auth/refresh + retry before giving up.
 */
const BASE = import.meta.env.VITE_API_BASE || '/api';

// Paths that must not trigger a refresh retry (they're auth endpoints themselves).
const NO_REFRESH = ['/auth/refresh', '/auth/login', '/auth/register', '/auth/google', '/auth/forgot-password', '/auth/reset-password'];

// App registers this so the client can bounce to /login without importing the store.
let authExpiredHandler: (() => void) | null = null;
export function setAuthExpiredHandler(fn: (() => void) | null) {
  authExpiredHandler = fn;
}

async function rawFetch(path: string, options: RequestInit): Promise<Response> {
  return fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
}

/** Perform a token refresh (raw — never retries itself). Returns true on success. */
async function tryRefresh(): Promise<boolean> {
  try {
    const res = await rawFetch('/auth/refresh', { method: 'POST' });
    return res.ok;
  } catch {
    return false;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    let res = await rawFetch(path, { ...options, signal: controller.signal });

    // Transparent refresh on 401 (once) for non-auth paths.
    if (res.status === 401 && !NO_REFRESH.some((p) => path.includes(p))) {
      const refreshed = await tryRefresh();
      if (refreshed) {
        res = await rawFetch(path, { ...options, signal: controller.signal }); // retry original
      } else {
        authExpiredHandler?.();
      }
    }

    if (!res.ok) {
      let detail = res.statusText;
      try {
        const j = await res.json();
        detail = j.message || detail;
      } catch {
        /* non-JSON error body */
      }
      throw new Error(`API ${path} → ${res.status}: ${detail}`);
    }
    const text = await res.text();
    try {
      return text ? (JSON.parse(text) as T) : (null as unknown as T);
    } catch {
      return text as unknown as T;
    }
  } finally {
    clearTimeout(timeout);
  }
}

export const api = {
  get: <T>(p: string) => request<T>(p),
  post: <T>(p: string, body?: unknown) =>
    request<T>(p, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(p: string, body?: unknown) =>
    request<T>(p, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(p: string) => request<T>(p, { method: 'DELETE' }),
};

/** Standard envelope unwrapper for typed responses. */
export interface Envelope<T> {
  success: boolean;
  message: string;
  data: T;
}
export const unwrap = <T>(p: Promise<Envelope<T>>): Promise<T> => p.then((e) => e.data);

/** Generate a client-side ID (UUID when available). */
export function newId(prefix = ''): string {
  const rnd =
    globalThis.crypto?.randomUUID?.() ??
    `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  return prefix ? `${prefix}_${rnd}` : rnd;
}

/** Persistent player id across sessions (stored in localStorage). */
export function getOrCreatePlayerId(): string {
  const KEY = 'stp_player_id';
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = newId('p');
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return newId('p');
  }
}

/** Generate a fresh player id and persist it (used when switching accounts). */
export function resetPlayerId(): string {
  const KEY = 'stp_player_id';
  const id = newId('p');
  try {
    localStorage.setItem(KEY, id);
  } catch { /* ignore */ }
  return id;
}
