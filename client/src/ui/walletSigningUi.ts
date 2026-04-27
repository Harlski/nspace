/** Main-site wallet Hub signing wait UI (spinner + “Signing in” with cycling dots). */

const SIGNING_DOT_STATES = [".", "..", "...", "."] as const;

export function walletSigningMarkup(): string {
  return (
    '<div class="ms-wallet-signing ms-wallet-signing--column" role="status" aria-live="polite">' +
    '<span class="ms-spinner" aria-hidden="true"></span>' +
    '<p class="ms-signing-in-line">' +
    '<span class="ms-signing-static">Signing in</span>' +
    '<span class="ms-signing-dots-live" aria-hidden="true">.</span>' +
    "</p>" +
    '<span class="ms-sr-only">Signing in</span>' +
    "</div>"
  );
}

/** Returns a disposer; call before replacing container HTML or navigating away. */
export function animateSigningDots(root: ParentNode): () => void {
  const el = root.querySelector(".ms-signing-dots-live");
  if (!el) return () => {};
  let i = 0;
  el.textContent = SIGNING_DOT_STATES[0];
  const t = window.setInterval(() => {
    i = (i + 1) % SIGNING_DOT_STATES.length;
    el.textContent = SIGNING_DOT_STATES[i];
  }, 400);
  return () => window.clearInterval(t);
}

export function isSigningUserCancelledError(e: unknown): boolean {
  const m = String(e instanceof Error ? e.message : e).toLowerCase();
  return (
    m.includes("connection was closed") ||
    m.includes("user closed") ||
    m.includes("user denied") ||
    m.includes("rejected") ||
    m.includes("aborted") ||
    m.includes("cancelled") ||
    m.includes("canceled")
  );
}
