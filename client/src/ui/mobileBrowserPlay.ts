import {
  getMobilePlayViewportSize,
  isMobilePlayHostDocument,
  isMobilePortraitDocument,
  isNimiqPayWebViewHost,
  isViewportPortrait,
  markMobileBrowserPlayHostDocument,
  scheduleMobilePlayLayoutResync,
  setPseudoFullscreen,
  syncMobileOrientationClasses,
  tryRequestFullscreen,
  unlockScreenOrientation,
} from "./pseudoFullscreen.js";

/** Coarse-pointer touch device (mobile browser / tablet), not desktop mouse. */
export function isCoarsePointerDevice(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(pointer: coarse)").matches;
}

/** Roll back to the legacy forced-landscape mobile presentation. */
export function isMobileBrowserPlayFallbackActive(): boolean {
  if (import.meta.env.VITE_MOBILE_BROWSER_PLAY === "0") return true;
  if (typeof window === "undefined") return false;
  const raw = new URLSearchParams(location.search).get("mobileBrowserPlay");
  if (raw === "0" || raw === "false") return true;
  if (raw === "1" || raw === "true") return false;
  return false;
}

export function shouldUseMobileBrowserPlay(): boolean {
  return (
    isCoarsePointerDevice() &&
    !isNimiqPayWebViewHost() &&
    !isMobileBrowserPlayFallbackActive()
  );
}

function lockLandscapeBestEffort(): void {
  if (typeof screen === "undefined") return;
  const orientation = (screen as Screen & {
    orientation?: { lock?: (type: string) => Promise<void> };
  }).orientation;
  if (!orientation?.lock) return;
  void orientation.lock("landscape").catch(() => {});
}

function readPortraitNow(): boolean {
  const { width, height } = getMobilePlayViewportSize();
  return isViewportPortrait(width, height);
}

function applyMobileBrowserImmersivePolicy(
  preferredFullscreenEl: HTMLElement
): void {
  if (!shouldUseMobileBrowserPlay()) return;

  setPseudoFullscreen(true);
  syncMobileOrientationClasses();
  const portrait = isMobilePortraitDocument() || readPortraitNow();

  if (portrait) {
    unlockScreenOrientation();
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
    }
    scheduleMobilePlayLayoutResync();
    return;
  }

  if (document.fullscreenElement) return;

  void tryRequestFullscreen(preferredFullscreenEl).then((entered) => {
    if (entered) lockLandscapeBestEffort();
    else lockLandscapeBestEffort();
  });
}

/**
 * Orientation-aware immersive layout for **Mobile Browser Play**:
 * portrait stays in the normal browser viewport; landscape requests fullscreen best-effort.
 */
export function syncMobileBrowserImmersiveLayout(
  preferredFullscreenEl: HTMLElement,
  _appEl: HTMLElement | null
): void {
  if (!shouldUseMobileBrowserPlay()) return;

  const run = (): void => applyMobileBrowserImmersivePolicy(preferredFullscreenEl);

  run();
  requestAnimationFrame(run);
  requestAnimationFrame(() => requestAnimationFrame(run));
  window.setTimeout(run, 100);
  window.setTimeout(run, 300);
}

let mobileBrowserLayoutLifecycleBound = false;

function bindMobileBrowserLayoutLifecycle(): void {
  if (mobileBrowserLayoutLifecycleBound || typeof window === "undefined") return;
  mobileBrowserLayoutLifecycleBound = true;

  const onOrientationChange = (): void => {
    if (!isMobilePlayHostDocument() || isNimiqPayWebViewHost()) return;
    const app = document.getElementById("app");
    syncMobileBrowserImmersiveLayout(app ?? document.documentElement, app);
  };

  window.addEventListener("pageshow", onOrientationChange);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible" || !shouldUseMobileBrowserPlay()) return;
    onOrientationChange();
  });
  const screenOrientation = (screen as Screen & {
    orientation?: { addEventListener?: ScreenOrientation["addEventListener"] };
  }).orientation;
  screenOrientation?.addEventListener?.("change", onOrientationChange);
  window.addEventListener("orientationchange", onOrientationChange);
  window.visualViewport?.addEventListener("resize", onOrientationChange);
}

/** From first page load on coarse-pointer mobile browsers (not Nimiq Pay). */
export function enableMobileBrowserPlayLayout(): void {
  if (!shouldUseMobileBrowserPlay()) return;
  markMobileBrowserPlayHostDocument();
  bindMobileBrowserLayoutLifecycle();
  syncMobileOrientationClasses();
  setPseudoFullscreen(true);
  scheduleMobilePlayLayoutResync();
  const app = document.getElementById("app");
  syncMobileBrowserImmersiveLayout(app ?? document.documentElement, app);
}
