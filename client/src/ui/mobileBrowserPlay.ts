import {
  isMobilePlayHostDocument,
  isMobilePortraitDocument,
  isNimiqPayWebViewHost,
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

function isAppFullscreenElement(
  fullscreenEl: Element,
  preferred: HTMLElement,
  appEl: HTMLElement | null
): boolean {
  return (
    fullscreenEl === preferred ||
    fullscreenEl === appEl ||
    fullscreenEl === document.documentElement ||
    fullscreenEl === document.body ||
    (!!appEl && appEl.contains(fullscreenEl))
  );
}

/**
 * Orientation-aware immersive layout for **Mobile Browser Play**:
 * portrait stays in the normal browser viewport; landscape requests fullscreen best-effort.
 */
export function syncMobileBrowserImmersiveLayout(
  preferredFullscreenEl: HTMLElement,
  appEl: HTMLElement | null
): void {
  if (!shouldUseMobileBrowserPlay()) return;

  setPseudoFullscreen(true);
  syncMobileOrientationClasses();

  if (isMobilePortraitDocument()) {
    unlockScreenOrientation();
    const fsEl = document.fullscreenElement;
    if (fsEl && isAppFullscreenElement(fsEl, preferredFullscreenEl, appEl)) {
      void document.exitFullscreen().catch(() => {});
    }
    return;
  }

  void tryRequestFullscreen(preferredFullscreenEl).then((entered) => {
    if (entered) lockLandscapeBestEffort();
    else lockLandscapeBestEffort();
  });
}

let mobileBrowserLayoutLifecycleBound = false;

function bindMobileBrowserLayoutLifecycle(): void {
  if (mobileBrowserLayoutLifecycleBound || typeof window === "undefined") return;
  mobileBrowserLayoutLifecycleBound = true;

  const onOrientationChange = (): void => {
    if (!isMobilePlayHostDocument() || isNimiqPayWebViewHost()) return;
    scheduleMobilePlayLayoutResync();
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
