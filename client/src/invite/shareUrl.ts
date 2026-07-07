import { isLocalDevPageOrigin } from "../net/apiBase.js";

/** Join link for QR / copy - LAN dev uses the page origin; localhost desktop uses server URL (LAN IP). */
export function resolvePlaySpaceShareUrl(serverShareUrl: string, slug: string): string {
  if (typeof location === "undefined") return serverShareUrl;
  const trimmedSlug = slug.trim();
  if (!trimmedSlug) return serverShareUrl;
  const path = `/join/${encodeURIComponent(trimmedSlug)}`;
  if (isLocalDevPageOrigin() && !isLoopbackHostname(location.hostname)) {
    return `${location.origin}${path}`;
  }
  return serverShareUrl;
}

function isLoopbackHostname(hostname: string): boolean {
  const h = hostname.trim().toLowerCase();
  return h === "localhost" || h === "127.0.0.1" || h === "[::1]" || h === "::1";
}

/** X (Twitter) compose intent for sharing a Play Space join link. */
export function buildPlaySpaceXShareUrl(shareUrl: string): string {
  const url = shareUrl.trim();
  if (!url) return "https://x.com/intent/tweet";
  const params = new URLSearchParams({
    text: "Join my private play space on Nimiq Space!",
    url,
  });
  return `https://x.com/intent/tweet?${params.toString()}`;
}
