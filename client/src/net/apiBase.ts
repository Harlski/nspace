/**
 * HTTP API origin. Empty string = same origin (Vite dev proxy / Vercel `/api` rewrite).
 * Set `VITE_API_BASE_URL` when the SPA is hosted separately from the API **and**
 * does not proxy `/api/*` (unusual for nimiq.space — leave unset on Vercel).
 *
 * On known SPA hosts (`nimiq.space`), HTTP always uses same-origin so `/api/*` rewrites
 * apply and browser requests avoid cross-origin CORS (502 upstream errors otherwise
 * look like CORS failures). WebSocket uses {@link resolveWebSocketOrigin} (`wss://api.nimiq.space` on prod).
 *
 * If the env value has no `https://` / `http://`, it is treated as a hostname and
 * `https://` is prepended (or `http://` for localhost / 127.0.0.1). Otherwise a value
 * like `api.example.com` is resolved by the browser as a **path** on the SPA host
 * and breaks requests.
 */

/** Production SPA hostnames that rewrite `/api/*` to the game server. */
const SPA_API_PROXY_HOSTS = new Set(["nimiq.space", "www.nimiq.space"]);

/** Default API origin for WS (and non-proxy SPA HTTP is not used). */
export const DEFAULT_PROD_API_ORIGIN = "https://api.nimiq.space";

function normalizeEnvOrigin(raw: string): string {
  const noTrailSlash = raw.replace(/\/$/, "");
  if (noTrailSlash.includes("://")) {
    try {
      return new URL(noTrailSlash).origin;
    } catch {
      return noTrailSlash;
    }
  }
  const lower = noTrailSlash.toLowerCase();
  const hostOnly = lower.replace(/:\d+$/, "");
  const useHttp =
    hostOnly === "localhost" ||
    hostOnly === "127.0.0.1" ||
    hostOnly === "[::1]" ||
    hostOnly === "::1" ||
    isPrivateNetworkHostname(hostOnly);
  const withScheme = `${useHttp ? "http://" : "https://"}${noTrailSlash}`;
  try {
    return new URL(withScheme).origin;
  } catch {
    return withScheme;
  }
}

export function isSpaApiProxyHost(hostname?: string): boolean {
  const h = (hostname ?? (typeof location !== "undefined" ? location.hostname : ""))
    .trim()
    .toLowerCase();
  return SPA_API_PROXY_HOSTS.has(h);
}

function isLocalHostname(hostname: string): boolean {
  const h = hostname.trim().toLowerCase();
  return h === "localhost" || h === "127.0.0.1" || h === "[::1]" || h === "::1";
}

/** RFC1918 / link-local IPv4 — typical Vite LAN dev URLs (`http://192.168.x.x:5173`). */
function isPrivateNetworkHostname(hostname: string): boolean {
  const h = hostname.trim().toLowerCase();
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (!m) return false;
  const octets = m.slice(1, 5).map((x) => Number(x));
  if (octets.some((o) => o > 255)) return false;
  const [a, b] = octets;
  if (a === 10) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 169 && b === 254) return true;
  return false;
}

/** Localhost or LAN dev host — WebSocket scheme follows the page (`ws` on http, `wss` on https). */
function isLocalDevHostname(hostname: string): boolean {
  return isLocalHostname(hostname) || isPrivateNetworkHostname(hostname);
}

function httpOriginFromEnvValue(raw: string): string {
  const noTrailSlash = raw.replace(/\/$/, "");
  if (/^wss?:\/\//i.test(noTrailSlash)) {
    const u = new URL(noTrailSlash);
    u.protocol = u.protocol === "wss:" ? "https:" : "http:";
    return u.origin;
  }
  return normalizeEnvOrigin(noTrailSlash);
}

export function resolveApiBaseUrl(): string {
  if (isSpaApiProxyHost()) return "";
  const raw = String(import.meta.env.VITE_API_BASE_URL ?? "").trim();
  if (!raw) return "";
  return normalizeEnvOrigin(raw);
}

/** HTTPS (or HTTP) origin used to derive the WebSocket URL. */
export function resolveWsApiOrigin(): string {
  const wsEnv = String(import.meta.env.VITE_WS_BASE_URL ?? "").trim();
  if (wsEnv) return httpOriginFromEnvValue(wsEnv);
  if (isSpaApiProxyHost()) return DEFAULT_PROD_API_ORIGIN;
  const api = resolveApiBaseUrl();
  if (api) return api;
  if (typeof location !== "undefined") return location.origin;
  return DEFAULT_PROD_API_ORIGIN;
}

/** WebSocket origin — `wss://` on HTTPS pages and non-local API hosts. */
export function resolveWebSocketOrigin(): string {
  const u = new URL(resolveWsApiOrigin());
  const pageHttps =
    typeof location !== "undefined" && location.protocol === "https:";
  const localDev = isLocalDevHostname(u.hostname);
  const secure = localDev ? pageHttps : pageHttps || !isLocalHostname(u.hostname);
  u.protocol = secure ? "wss:" : "ws:";
  return u.origin;
}

export function apiUrl(path: string): string {
  const base = resolveApiBaseUrl();
  const p = path.startsWith("/") ? path : `/${path}`;
  if (!base) return p;
  return `${base}${p}`;
}
