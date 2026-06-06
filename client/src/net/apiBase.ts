/**
 * HTTP API origin. Empty string = same origin (Vite dev proxy / Vercel `/api` rewrite).
 * Set `VITE_API_BASE_URL` when the SPA is hosted separately from the API **and**
 * does not proxy `/api/*` (unusual for nimiq.space — leave unset on Vercel).
 *
 * On known SPA hosts (`nimiq.space`), HTTP always uses same-origin so `/api/*` rewrites
 * apply and browser requests avoid cross-origin CORS (502 upstream errors otherwise
 * look like CORS failures). WebSocket still uses {@link resolveWsApiOrigin}.
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
  const useHttp =
    lower.startsWith("localhost") ||
    lower.startsWith("127.0.0.1") ||
    lower.startsWith("[::1]");
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

export function resolveApiBaseUrl(): string {
  if (isSpaApiProxyHost()) return "";
  const raw = String(import.meta.env.VITE_API_BASE_URL ?? "").trim();
  if (!raw) return "";
  return normalizeEnvOrigin(raw);
}

/** HTTPS (or HTTP) origin used to derive the WebSocket URL. */
export function resolveWsApiOrigin(): string {
  const wsEnv = String(import.meta.env.VITE_WS_BASE_URL ?? "").trim();
  if (wsEnv) return normalizeEnvOrigin(wsEnv.replace(/\/$/, ""));
  if (isSpaApiProxyHost()) return DEFAULT_PROD_API_ORIGIN;
  const api = resolveApiBaseUrl();
  if (api) return api;
  if (typeof location !== "undefined") return location.origin;
  return DEFAULT_PROD_API_ORIGIN;
}

export function apiUrl(path: string): string {
  const base = resolveApiBaseUrl();
  const p = path.startsWith("/") ? path : `/${path}`;
  if (!base) return p;
  return `${base}${p}`;
}
