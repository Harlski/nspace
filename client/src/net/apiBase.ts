/**
 * HTTP API origin. Empty string = same origin (dev proxy / single-host prod).
 * Set `VITE_API_BASE_URL` when the SPA is hosted separately from the API.
 */
export function apiUrl(path: string): string {
  const base = String(import.meta.env.VITE_API_BASE_URL ?? "").replace(
    /\/$/,
    ""
  );
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}
