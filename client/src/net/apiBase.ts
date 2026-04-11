/**
 * HTTP API origin. Empty string = same origin (dev proxy / single-host prod).
 * Set `VITE_API_BASE_URL` when the SPA is hosted separately from the API.
 *
 * If the env value has no `https://` / `http://`, it is treated as a hostname and
 * `https://` is prepended (or `http://` for localhost / 127.0.0.1). Otherwise a value
 * like `api.example.com` is resolved by the browser as a **path** on the SPA host
 * and breaks requests.
 */
export function resolveApiBaseUrl(): string {
  const raw = String(import.meta.env.VITE_API_BASE_URL ?? "").trim();
  if (!raw) return "";
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

export function apiUrl(path: string): string {
  const base = resolveApiBaseUrl();
  const p = path.startsWith("/") ? path : `/${path}`;
  if (!base) return p;
  return `${base}${p}`;
}
