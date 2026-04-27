import {
  isTokenExpired,
  listCachedSessions,
  loadCachedSession,
  removeCachedSession,
  saveCachedSession,
} from "../auth/session.js";

/** Shared session keys so wallet login works across main-site tools. */
export const MAIN_SITE_AUTH_TOKEN_KEYS = [
  "nspace_analytics_auth_token",
  "nspace_pending_payouts_token",
] as const;

export const MAIN_SITE_AUTH_ADDR_KEY = "nspace_analytics_auth_addr";

export function normalizeMainSiteWalletKey(walletId: string): string {
  return String(walletId || "").replace(/\s+/g, "").toUpperCase();
}

/** Apply a cached session as the active main-site tab session and refresh LRU in localStorage. */
export function activateMainSiteCachedAccount(address: string): boolean {
  const want = normalizeMainSiteWalletKey(address);
  const entry = listCachedSessions().find((e) => normalizeMainSiteWalletKey(e.address) === want);
  if (!entry) return false;
  writeMainSiteAuthToken(entry.token, entry.address);
  return true;
}

function setSessionTokens(token: string): void {
  for (const k of MAIN_SITE_AUTH_TOKEN_KEYS) {
    sessionStorage.setItem(k, token);
  }
}

/** Prefer tab session; otherwise hydrate from in-game `localStorage` cache (same JWT keys). */
export function readMainSiteAuthToken(): string {
  for (const k of MAIN_SITE_AUTH_TOKEN_KEYS) {
    const t = sessionStorage.getItem(k);
    if (t) return t;
  }
  const cached = loadCachedSession();
  if (!cached?.token) return "";
  setSessionTokens(cached.token);
  if (cached.address) {
    sessionStorage.setItem(MAIN_SITE_AUTH_ADDR_KEY, cached.address);
  }
  return cached.token;
}

export function writeMainSiteAuthToken(token: string, address?: string): void {
  setSessionTokens(token);
  const addr = (address ?? sessionStorage.getItem(MAIN_SITE_AUTH_ADDR_KEY) ?? "").trim();
  if (addr) {
    sessionStorage.setItem(MAIN_SITE_AUTH_ADDR_KEY, addr);
    saveCachedSession(token, addr);
  }
}

export function clearMainSiteAuthSession(): void {
  const addr = sessionStorage.getItem(MAIN_SITE_AUTH_ADDR_KEY)?.trim() ?? "";
  for (const k of MAIN_SITE_AUTH_TOKEN_KEYS) {
    sessionStorage.removeItem(k);
  }
  sessionStorage.removeItem(MAIN_SITE_AUTH_ADDR_KEY);
  if (addr) removeCachedSession(addr);
}
