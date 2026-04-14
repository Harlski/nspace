const STORAGE_KEY = "nspace_auth_v1";
const STORAGE_ACCOUNTS_KEY = "nspace_auth_accounts_v1";
const MAX_CACHED_ACCOUNTS = 6;

export interface CachedSession {
  token: string;
  address: string;
}

export interface CachedSessionEntry extends CachedSession {
  updatedAt: number;
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

export function getTokenExpiryMs(token: string): number | null {
  const p = parseJwtPayload(token);
  if (!p || typeof p.exp !== "number") return null;
  return p.exp * 1000;
}

/** True if token is missing exp or already past (with skew). */
export function isTokenExpired(token: string, skewSec = 120): boolean {
  const expMs = getTokenExpiryMs(token);
  if (!expMs) return true;
  return expMs < Date.now() + skewSec * 1000;
}

function sanitizeEntry(data: unknown): CachedSessionEntry | null {
  if (
    !data ||
    typeof data !== "object" ||
    typeof (data as CachedSession).token !== "string" ||
    typeof (data as CachedSession).address !== "string"
  ) {
    return null;
  }
  const updatedAtRaw = (data as { updatedAt?: unknown }).updatedAt;
  const updatedAt =
    typeof updatedAtRaw === "number" && Number.isFinite(updatedAtRaw)
      ? updatedAtRaw
      : Date.now();
  const address = (data as CachedSession).address.trim();
  if (!address) return null;
  return {
    token: (data as CachedSession).token,
    address,
    updatedAt,
  };
}

function readAccountEntries(): CachedSessionEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_ACCOUNTS_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return [];
    const out: CachedSessionEntry[] = [];
    for (const item of data) {
      const s = sanitizeEntry(item);
      if (s) out.push(s);
    }
    out.sort((a, b) => b.updatedAt - a.updatedAt);
    return out.slice(0, MAX_CACHED_ACCOUNTS);
  } catch {
    return [];
  }
}

function writeAccountEntries(entries: CachedSessionEntry[]): void {
  try {
    localStorage.setItem(
      STORAGE_ACCOUNTS_KEY,
      JSON.stringify(entries.slice(0, MAX_CACHED_ACCOUNTS))
    );
  } catch {
    /* ignore quota */
  }
}

function migrateLegacyIfNeeded(entries: CachedSessionEntry[]): CachedSessionEntry[] {
  if (entries.length > 0) return entries;
  const legacy = loadLegacyCachedSession();
  if (!legacy) return entries;
  const migrated: CachedSessionEntry = {
    ...legacy,
    updatedAt: Date.now(),
  };
  writeAccountEntries([migrated]);
  return [migrated];
}

function loadLegacyCachedSession(): CachedSession | null {
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

export function listCachedSessions(): CachedSessionEntry[] {
  const entries = migrateLegacyIfNeeded(readAccountEntries());
  return entries;
}

export function loadCachedSession(): CachedSession | null {
  const entries = listCachedSessions();
  if (entries.length === 0) return null;
  const valid = entries.find((e) => !isTokenExpired(e.token));
  const pick = valid ?? entries[0] ?? null;
  return pick ? { token: pick.token, address: pick.address } : null;
}

export function saveCachedSession(token: string, address: string): void {
  const trimmed = address.trim();
  if (!trimmed) return;
  const next: CachedSessionEntry = {
    token,
    address: trimmed,
    updatedAt: Date.now(),
  };
  const entries = listCachedSessions().filter((e) => e.address !== trimmed);
  entries.unshift(next);
  writeAccountEntries(entries);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, address: trimmed }));
  } catch {
    /* ignore quota */
  }
}

export function removeCachedSession(address: string): void {
  const trimmed = address.trim();
  if (!trimmed) return;
  const remaining = listCachedSessions().filter((e) => e.address !== trimmed);
  writeAccountEntries(remaining);
  const legacy = loadLegacyCachedSession();
  if (legacy && legacy.address.trim() === trimmed) {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }
}

export function clearCachedSession(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_ACCOUNTS_KEY);
  } catch {
    /* ignore */
  }
}
