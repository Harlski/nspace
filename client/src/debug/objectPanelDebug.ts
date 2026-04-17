/**
 * Enable with `?debugObjectPanel=1` or `localStorage.setItem('nspaceDebugObjectPanel', '1')`.
 * Logs obstacle selection + object panel lifecycle to the console.
 */
export function isObjectPanelDebugEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (new URLSearchParams(window.location.search).get("debugObjectPanel") === "1") {
      return true;
    }
    return window.localStorage.getItem("nspaceDebugObjectPanel") === "1";
  } catch {
    return false;
  }
}

export function logObjectPanel(...args: unknown[]): void {
  if (!isObjectPanelDebugEnabled()) return;
  // eslint-disable-next-line no-console -- intentional debug channel
  console.debug("[objectPanel]", ...args);
}
