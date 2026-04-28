/** Class on `<html>` when we emulate fullscreen (e.g. Nimiq Pay WebView where Fullscreen API is unavailable). */
const PSEUDO_FS_CLASS = "nspace-pseudo-fs";

/** True when Nimiq Pay injected the host context (same signal as mini-app auth). */
export function isNimiqPayWebViewHost(): boolean {
  if (typeof window === "undefined") return false;
  return window.nimiqPay != null;
}

let visualViewportCleanup: (() => void) | null = null;

function syncVisualViewportCssVars(): void {
  const vv = window.visualViewport;
  if (!vv) return;
  const root = document.documentElement;
  root.style.setProperty("--nspace-vvh", `${vv.height}px`);
  root.style.setProperty("--nspace-vv-top", `${vv.offsetTop}px`);
}

function clearVisualViewportCssVars(): void {
  const root = document.documentElement;
  root.style.removeProperty("--nspace-vvh");
  root.style.removeProperty("--nspace-vv-top");
}

function startVisualViewportSync(): void {
  visualViewportCleanup?.();
  visualViewportCleanup = null;
  const vv = window.visualViewport;
  if (!vv) return;
  syncVisualViewportCssVars();
  vv.addEventListener("resize", syncVisualViewportCssVars);
  vv.addEventListener("scroll", syncVisualViewportCssVars);
  visualViewportCleanup = () => {
    vv.removeEventListener("resize", syncVisualViewportCssVars);
    vv.removeEventListener("scroll", syncVisualViewportCssVars);
    clearVisualViewportCssVars();
  };
}

/**
 * Best-effort: ask the Pay WebView to maximize content area. Not in public Nimiq docs;
 * safe no-op if unsupported.
 */
export function requestMiniAppImmersiveLayout(): void {
  const pay = window.nimiqPay;
  if (!pay || typeof pay !== "object") return;
  const o = pay as Record<string, unknown>;
  for (const key of [
    "expand",
    "requestExpand",
    "setExpanded",
    "setMaximized",
    "enterFullscreen",
    "requestFullscreen",
  ] as const) {
    const fn = o[key];
    if (typeof fn === "function") {
      try {
        void (fn as (this: typeof pay, v?: boolean) => unknown).call(pay, true);
      } catch {
        /* ignore */
      }
    }
  }
}

export function isPseudoFullscreenActive(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.classList.contains(PSEUDO_FS_CLASS);
}

export function isVisualFullscreenActive(): boolean {
  return !!document.fullscreenElement || isPseudoFullscreenActive();
}

export function setPseudoFullscreen(on: boolean): void {
  if (typeof document === "undefined") return;
  visualViewportCleanup?.();
  visualViewportCleanup = null;
  if (on) {
    document.documentElement.classList.add(PSEUDO_FS_CLASS);
    if (isNimiqPayWebViewHost()) {
      requestMiniAppImmersiveLayout();
    }
    startVisualViewportSync();
  } else {
    document.documentElement.classList.remove(PSEUDO_FS_CLASS);
    clearVisualViewportCssVars();
  }
  document.dispatchEvent(new Event("nspace-pseudo-fullscreen-change"));
}

/**
 * Tries the Fullscreen API on `preferred`, then `<html>`, then `<body>`.
 * Returns whether the document actually entered fullscreen.
 */
export async function tryRequestFullscreen(preferred: HTMLElement): Promise<boolean> {
  const order: Element[] = [preferred, document.documentElement, document.body];
  for (const el of order) {
    try {
      await (el as HTMLElement).requestFullscreen();
    } catch {
      continue;
    }
    if (document.fullscreenElement) return true;
  }
  return false;
}
