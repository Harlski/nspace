const STORAGE_KEY = "nspace_auth_v1";

export interface CachedSession {
  token: string;
  address: string;
}

function parseJwtPayload(token: string): { exp?: number } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const base64 = parts[1]!.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const json = atob(padded);
    return JSON.parse(json) as { exp?: number };
  } catch {
    return null;
  }
}

/** True if token is missing exp or already past (with skew). */
export function isTokenExpired(token: string, skewSec = 120): boolean {
  const p = parseJwtPayload(token);
  if (!p || typeof p.exp !== "number") return true;
  return p.exp * 1000 < Date.now() + skewSec * 1000;
}

export function loadCachedSession(): CachedSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as unknown;
    if (
      !data ||
      typeof data !== "object" ||
      typeof (data as CachedSession).token !== "string" ||
      typeof (data as CachedSession).address !== "string"
    ) {
      return null;
    }
    return { token: (data as CachedSession).token, address: (data as CachedSession).address };
  } catch {
    return null;
  }
}

export function saveCachedSession(token: string, address: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, address }));
  } catch {
    /* ignore quota */
  }
}

export function clearCachedSession(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
