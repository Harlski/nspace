/** Nimiq Pay mini-app deeplink for *external* entry (tap link → open Pay). Not for in-WebView hops. */
export function buildNimiqPayMiniappDeepLink(targetHostOrUrl: string): string {
  const t = targetHostOrUrl.trim();
  return `nimiqpay://miniapp?url=${encodeURIComponent(t)}`;
}

/** Normalize a host or URL to HTTPS. */
export function miniappTargetToHttpsUrl(targetHostOrUrl: string): string {
  const t = targetHostOrUrl.trim();
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

/**
 * Open a competitor mini-app by navigating the current WebView/tab to its HTTPS URL.
 *
 * When already inside Nimiq Pay, `nimiqpay://miniapp` deeplinks are meant for opening Pay
 * from *outside* the app; assigning them in-WebView often disconnects without loading the
 * target. In-place HTTPS navigation loads the other mini-app in the same Pay shell.
 */
export function openMiniappTarget(targetHostOrUrl: string): void {
  const t = targetHostOrUrl.trim();
  if (!t) return;
  window.location.assign(miniappTargetToHttpsUrl(t));
}
