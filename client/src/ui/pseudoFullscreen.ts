/** Class on `<html>` when we emulate fullscreen (e.g. Nimiq Pay WebView where Fullscreen API is unavailable). */
const PSEUDO_FS_CLASS = "nspace-pseudo-fs";

/** Dev-only: `?payEmulate=portrait|landscape` or `?payEmulate=1` (orientation from viewport). */
let payEmulateForcedOrientation: "portrait" | "landscape" | null = null;

/**
 * Local dev: stub `window.nimiqPay` when `?payEmulate` is present so Pay HUD/layout runs in a desktop browser.
 * Use Chrome DevTools device mode (e.g. iPhone 12) for accurate viewport size; optional `portrait` / `landscape` forces orientation classes.
 */
export function initNimiqPayDevEmulation(): void {
  if (typeof window === "undefined" || !import.meta.env.DEV) return;
  const raw = new URLSearchParams(location.search).get("payEmulate");
  if (raw === null || raw === "0" || raw === "false") return;
  payEmulateForcedOrientation =
    raw === "portrait"
      ? "portrait"
      : raw === "landscape"
        ? "landscape"
        : null;
  if (window.nimiqPay == null) {
    window.nimiqPay = {};
  }
}

/** True when Nimiq Pay injected the host context (same signal as mini-app auth). */
export function isNimiqPayWebViewHost(): boolean {
  if (typeof window === "undefined") return false;
  return window.nimiqPay != null;
}

const NIMIQ_PAY_HOST_CLASS = "nspace-nimiq-pay-host";
const NIMIQ_PAY_PORTRAIT_CLASS = "nspace-nimiq-pay-portrait";
const NIMIQ_PAY_LANDSCAPE_CLASS = "nspace-nimiq-pay-landscape";

/** Matches [`DESIGN_WIDTH` / `DESIGN_HEIGHT`](client/src/game/constants.ts) (16:9). */
const NIMIQ_PAY_GAME_ASPECT = 1280 / 720;

/** Tag `<html>` when running inside Nimiq Pay (call once at startup). */
export function markNimiqPayHostDocument(): void {
  if (typeof document === "undefined") return;
  if (!isNimiqPayWebViewHost()) return;
  document.documentElement.classList.add(NIMIQ_PAY_HOST_CLASS);
}

export function isNimiqPayHostDocument(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.classList.contains(NIMIQ_PAY_HOST_CLASS);
}

export function isNimiqPayPortraitViewport(width: number, height: number): boolean {
  if (!width || !height) return false;
  return width / height < NIMIQ_PAY_GAME_ASPECT;
}

export function isNimiqPayPortraitDocument(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.classList.contains(NIMIQ_PAY_PORTRAIT_CLASS);
}

/**
 * Toggles portrait/landscape Pay classes on `<html>`.
 * Returns `true` when portrait, `false` when landscape, `null` when not a Pay host.
 */
export function syncNimiqPayOrientationClasses(
  width?: number,
  height?: number
): boolean | null {
  if (!isNimiqPayHostDocument()) return null;
  let w = width;
  let h = height;
  if (w == null || h == null) {
    const vv = window.visualViewport;
    w = vv?.width ?? window.innerWidth;
    h = vv?.height ?? window.innerHeight;
  }
  const portrait =
    payEmulateForcedOrientation === "portrait"
      ? true
      : payEmulateForcedOrientation === "landscape"
        ? false
        : isNimiqPayPortraitViewport(w, h);
  const root = document.documentElement;
  root.classList.toggle(NIMIQ_PAY_PORTRAIT_CLASS, portrait);
  root.classList.toggle(NIMIQ_PAY_LANDSCAPE_CLASS, !portrait);
  return portrait;
}

/** Fill the Pay WebView visible viewport (no Fullscreen API); safe to call repeatedly. */
export function enableNimiqPayViewportLayout(): void {
  if (!isNimiqPayWebViewHost()) return;
  markNimiqPayHostDocument();
  syncNimiqPayOrientationClasses();
  requestMiniAppImmersiveLayout();
  setPseudoFullscreen(true);
}

let visualViewportCleanup: (() => void) | null = null;

function syncVisualViewportCssVars(): void {
  const vv = window.visualViewport;
  if (!vv) return;
  const root = document.documentElement;
  root.style.setProperty("--nspace-vvh", `${vv.height}px`);
  root.style.setProperty("--nspace-vv-top", `${vv.offsetTop}px`);
  if (isNimiqPayHostDocument()) {
    syncNimiqPayOrientationClasses(vv.width, vv.height);
  }
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
