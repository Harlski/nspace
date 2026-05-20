import { ringHueFromClient } from "./ringHuePick.js";

/** Shared circular palette hue control (build bar, bottom dock, object panel, room sky). */
export const PALETTE_HUE_RING_WRAP = "palette-hue-ring";
export const PALETTE_HUE_RING_BAND = "palette-hue-ring__band";
export const PALETTE_HUE_RING_CORE = "palette-hue-ring__core";

export type PaletteHueRingElements = {
  wrap: HTMLDivElement;
  ring: HTMLElement;
  core: HTMLElement;
};

export function createPaletteHueRing(opts: {
  ariaLabel: string;
  title?: string;
  ariaValueNow?: number;
}): PaletteHueRingElements {
  const wrap = document.createElement("div");
  wrap.className = PALETTE_HUE_RING_WRAP;
  if (opts.title) wrap.title = opts.title;
  const ring = document.createElement("div");
  ring.className = PALETTE_HUE_RING_BAND;
  ring.setAttribute("role", "slider");
  ring.setAttribute("tabindex", "0");
  ring.setAttribute("aria-valuemin", "0");
  ring.setAttribute("aria-valuemax", "359");
  ring.setAttribute("aria-valuenow", String(opts.ariaValueNow ?? 0));
  ring.setAttribute("aria-label", opts.ariaLabel);
  const core = document.createElement("div");
  core.className = PALETTE_HUE_RING_CORE;
  core.setAttribute("aria-hidden", "true");
  wrap.appendChild(ring);
  wrap.appendChild(core);
  return { wrap, ring, core };
}

/**
 * Pointer drag on the ring band; center hole yields no pick (see ringHuePick).
 */
export function attachPaletteHueRingPointerHandlers(
  wrap: HTMLElement,
  ring: HTMLElement,
  onHueDeg: (deg: number) => void,
  options?: {
    /** Return false to ignore the gesture (e.g. panel hidden). */
    guard?: () => boolean;
    onPointerDownAccepted?: () => void;
    onPointerUpAfterRelease?: () => void;
  }
): void {
  const pass = (): boolean => options?.guard?.() !== false;
  const pick = (ev: PointerEvent): void => {
    const hue = ringHueFromClient(ring, ev.clientX, ev.clientY);
    if (hue === null) return;
    onHueDeg(hue);
  };
  wrap.addEventListener("pointerdown", (e) => {
    if (!pass()) return;
    options?.onPointerDownAccepted?.();
    wrap.setPointerCapture(e.pointerId);
    pick(e);
  });
  wrap.addEventListener("pointermove", (e) => {
    if (!wrap.hasPointerCapture(e.pointerId)) return;
    pick(e);
  });
  const release = (e: PointerEvent): void => {
    if (!wrap.hasPointerCapture(e.pointerId)) return;
    try {
      wrap.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    options?.onPointerUpAfterRelease?.();
  };
  wrap.addEventListener("pointerup", release);
  wrap.addEventListener("pointercancel", release);
}

export function attachPaletteHueRingArrowKeys(
  ring: HTMLElement,
  getHueDeg: () => number,
  onHueDeg: (deg: number) => void
): void {
  ring.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      onHueDeg(getHueDeg() - 12);
    } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      onHueDeg(getHueDeg() + 12);
    }
  });
}
