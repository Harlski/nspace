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

/** Release a prior `screen.orientation.lock` (e.g. after visiting another mini-app). */
export function unlockScreenOrientation(): void {
  if (typeof screen === "undefined") return;
  const orientation = (screen as Screen & { orientation?: { unlock?: () => void } })
    .orientation;
  orientation?.unlock?.();
}

/**
 * After cross-mini-app navigation, `window.nimiqPay` can appear a few frames after load.
 * Wait briefly so Pay HUD/layout initializes (login menu delay usually hides this race).
 */
export function waitForNimiqPayWebViewHost(timeoutMs = 3000): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.nimiqPay != null) return Promise.resolve(true);
  return new Promise((resolve) => {
    const deadline = Date.now() + timeoutMs;
    const tick = (): void => {
      if (window.nimiqPay != null) {
        resolve(true);
        return;
      }
      if (Date.now() >= deadline) {
        resolve(false);
        return;
      }
      requestAnimationFrame(tick);
    };
    tick();
  });
}

const NIMIQ_PAY_HOST_CLASS = "nspace-nimiq-pay-host";
export const MOBILE_PLAY_HOST_CLASS = "nspace-mobile-play-host";
export const MOBILE_BROWSER_HOST_CLASS = "nspace-mobile-browser-host";
export const MOBILE_PORTRAIT_CLASS = "nspace-mobile-portrait";
export const MOBILE_LANDSCAPE_CLASS = "nspace-mobile-landscape";

/** Matches [`DESIGN_WIDTH` / `DESIGN_HEIGHT`](client/src/game/constants.ts) (16:9). */
const MOBILE_GAME_ASPECT = 1280 / 720;

export function markMobilePlayHostDocument(): void {
  if (typeof document === "undefined") return;
  document.documentElement.classList.add(MOBILE_PLAY_HOST_CLASS);
}

export function isMobilePlayHostDocument(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.classList.contains(MOBILE_PLAY_HOST_CLASS);
}

export function markMobileBrowserPlayHostDocument(): void {
  if (typeof document === "undefined") return;
  document.documentElement.classList.add(MOBILE_BROWSER_HOST_CLASS);
  markMobilePlayHostDocument();
}

export function isMobileBrowserPlayHostDocument(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.classList.contains(MOBILE_BROWSER_HOST_CLASS);
}

/** Tag `<html>` when running inside Nimiq Pay (call once at startup). */
export function markNimiqPayHostDocument(): void {
  if (typeof document === "undefined") return;
  if (!isNimiqPayWebViewHost()) return;
  document.documentElement.classList.add(NIMIQ_PAY_HOST_CLASS);
  markMobilePlayHostDocument();
}

export function isNimiqPayHostDocument(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.classList.contains(NIMIQ_PAY_HOST_CLASS);
}

export function isMobilePortraitViewport(width: number, height: number): boolean {
  if (!width || !height) return false;
  return width / height < MOBILE_GAME_ASPECT;
}

/**
 * Portrait vs landscape for Pay / mobile-play HUD layout.
 * Uses measured viewport aspect - not `matchMedia(orientation)` - so letterbox math
 * does not run landscape sizing on portrait dimensions mid-rotation.
 */
export function isMobilePlayLayoutPortrait(width: number, height: number): boolean {
  if (payEmulateForcedOrientation === "portrait") return true;
  if (payEmulateForcedOrientation === "landscape") return false;
  return isMobilePortraitViewport(width, height);
}

/** Portrait when the platform reports it, otherwise infer from viewport aspect. */
export function isViewportPortrait(width: number, height: number): boolean {
  if (typeof window !== "undefined") {
    if (window.matchMedia("(orientation: portrait)").matches) return true;
    if (window.matchMedia("(orientation: landscape)").matches) return false;
  }
  return isMobilePortraitViewport(width, height);
}

/** @deprecated Use `isMobilePortraitViewport`. */
export const isNimiqPayPortraitViewport = isMobilePortraitViewport;

/** Visible viewport inside mobile hosts (preferred over layout/frame size for orientation). */
export function getMobilePlayViewportSize(): { width: number; height: number } {
  const vv = window.visualViewport;
  return {
    width: vv?.width ?? window.innerWidth,
    height: vv?.height ?? window.innerHeight,
  };
}

/** @deprecated Use `getMobilePlayViewportSize`. */
export const getNimiqPayViewportSize = getMobilePlayViewportSize;

export function isMobilePortraitDocument(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.classList.contains(MOBILE_PORTRAIT_CLASS);
}

/** @deprecated Use `isMobilePortraitDocument`. */
export const isNimiqPayPortraitDocument = isMobilePortraitDocument;

/**
 * Toggles portrait/landscape classes on `<html>`.
 * Returns `true` when portrait, `false` when landscape, `null` when not a mobile play host.
 */
export function syncMobileOrientationClasses(
  width?: number,
  height?: number
): boolean | null {
  if (!isMobilePlayHostDocument()) return null;
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
        : isMobilePlayHostDocument()
          ? isMobilePlayLayoutPortrait(w, h)
          : isViewportPortrait(w, h);
  const root = document.documentElement;
  root.classList.toggle(MOBILE_PORTRAIT_CLASS, portrait);
  root.classList.toggle(MOBILE_LANDSCAPE_CLASS, !portrait);
  return portrait;
}

/** @deprecated Use `syncMobileOrientationClasses`. */
export const syncNimiqPayOrientationClasses = syncMobileOrientationClasses;

let mobilePlayLayoutLifecycleBound = false;

function bindMobilePlayLayoutLifecycle(): void {
  if (mobilePlayLayoutLifecycleBound || typeof window === "undefined") return;
  mobilePlayLayoutLifecycleBound = true;
  window.addEventListener("pageshow", () => {
    if (!isMobilePlayHostDocument()) return;
    if (isNimiqPayWebViewHost()) {
      enableNimiqPayViewportLayout();
    }
    scheduleMobilePlayLayoutResync();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible" || !isMobilePlayHostDocument()) return;
    unlockScreenOrientation();
    syncMobileOrientationClasses();
    if (isNimiqPayWebViewHost()) {
      requestMiniAppImmersiveLayout();
    }
    scheduleMobilePlayLayoutResync();
  });
  const screenOrientation = (screen as Screen & {
    orientation?: { addEventListener?: ScreenOrientation["addEventListener"] };
  }).orientation;
  screenOrientation?.addEventListener?.("change", () => {
    if (!isMobilePlayHostDocument()) return;
    scheduleMobilePlayLayoutResync();
  });
  window.addEventListener("orientationchange", () => {
    if (!isMobilePlayHostDocument()) return;
    scheduleMobilePlayLayoutResync();
  });
}

/**
 * Re-sync orientation after cross-mini-app navigation when the WebView
 * reports layout vs visual viewport sizes out of step briefly.
 */
export function scheduleMobilePlayLayoutResync(): void {
  if (!isMobilePlayHostDocument()) return;
  const tick = (): void => {
    syncMobileOrientationClasses();
    document.dispatchEvent(new Event("nspace-pseudo-fullscreen-change"));
  };
  tick();
  requestAnimationFrame(tick);
  requestAnimationFrame(() => requestAnimationFrame(tick));
  window.setTimeout(tick, 100);
  window.setTimeout(tick, 400);
}

/** @deprecated Use `scheduleMobilePlayLayoutResync`. */
export const scheduleNimiqPayLayoutResync = scheduleMobilePlayLayoutResync;

/** Fill the Pay WebView visible viewport (no Fullscreen API); safe to call repeatedly. */
export function enableNimiqPayViewportLayout(): void {
  if (!isNimiqPayWebViewHost()) return;
  markNimiqPayHostDocument();
  bindMobilePlayLayoutLifecycle();
  syncMobileOrientationClasses();
  requestMiniAppImmersiveLayout();
  setPseudoFullscreen(true);
  scheduleMobilePlayLayoutResync();
}

let visualViewportCleanup: (() => void) | null = null;

function syncVisualViewportCssVars(): void {
  const vv = window.visualViewport;
  if (!vv) return;
  const root = document.documentElement;
  root.style.setProperty("--nspace-vvh", `${vv.height}px`);
  root.style.setProperty("--nspace-vv-top", `${vv.offsetTop}px`);
  if (isMobilePlayHostDocument()) {
    syncMobileOrientationClasses(vv.width, vv.height);
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
