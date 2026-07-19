import {
  clampColorRgb,
  formatColorRgbHex,
  hsvToRgbNumber,
  rgbToHsv,
  type BlockColorHsv,
} from "../game/blockStyle.js";

/** Rectangular SV field + vertical hue strip (Option A spectrum picker). */
export const PALETTE_SV_PICKER = "palette-sv-picker";
export const PALETTE_SV_FIELD = "palette-sv-picker__sv";
export const PALETTE_SV_CURSOR = "palette-sv-picker__sv-cursor";
export const PALETTE_SV_HUE = "palette-sv-picker__hue";
export const PALETTE_SV_HUE_CURSOR = "palette-sv-picker__hue-cursor";

export type PaletteSvPickerElements = {
  wrap: HTMLDivElement;
  sv: HTMLElement;
  svCursor: HTMLElement;
  hue: HTMLElement;
  hueCursor: HTMLElement;
};

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function normFromClient(
  el: HTMLElement,
  clientX: number,
  clientY: number
): { x: number; y: number } {
  const r = el.getBoundingClientRect();
  const w = Math.max(1, r.width);
  const h = Math.max(1, r.height);
  return {
    x: clamp01((clientX - r.left) / w),
    y: clamp01((clientY - r.top) / h),
  };
}

export function createPaletteSvPicker(opts: {
  ariaLabel: string;
  title?: string;
}): PaletteSvPickerElements {
  const wrap = document.createElement("div");
  wrap.className = PALETTE_SV_PICKER;
  if (opts.title) wrap.title = opts.title;
  wrap.setAttribute("role", "group");
  wrap.setAttribute("aria-label", opts.ariaLabel);

  const sv = document.createElement("div");
  sv.className = PALETTE_SV_FIELD;
  sv.setAttribute("role", "slider");
  sv.setAttribute("tabindex", "0");
  sv.setAttribute("aria-label", `${opts.ariaLabel} saturation and brightness`);
  sv.setAttribute("aria-valuemin", "0");
  sv.setAttribute("aria-valuemax", "100");
  sv.setAttribute("aria-valuenow", "50");
  sv.setAttribute("aria-valuetext", "Saturation and brightness");

  const svCursor = document.createElement("div");
  svCursor.className = PALETTE_SV_CURSOR;
  svCursor.setAttribute("aria-hidden", "true");
  sv.appendChild(svCursor);

  const hue = document.createElement("div");
  hue.className = PALETTE_SV_HUE;
  hue.setAttribute("role", "slider");
  hue.setAttribute("tabindex", "0");
  hue.setAttribute("aria-label", `${opts.ariaLabel} hue`);
  hue.setAttribute("aria-valuemin", "0");
  hue.setAttribute("aria-valuemax", "359");
  hue.setAttribute("aria-valuenow", "0");
  hue.setAttribute("aria-orientation", "vertical");

  const hueCursor = document.createElement("div");
  hueCursor.className = PALETTE_SV_HUE_CURSOR;
  hueCursor.setAttribute("aria-hidden", "true");
  hue.appendChild(hueCursor);

  wrap.append(sv, hue);
  return { wrap, sv, svCursor, hue, hueCursor };
}

function paintPicker(
  parts: PaletteSvPickerElements,
  hsv: BlockColorHsv
): void {
  const h = ((hsv.h % 360) + 360) % 360;
  const s = clamp01(hsv.s);
  const v = clamp01(hsv.v);
  parts.sv.style.setProperty("--palette-sv-hue", String(h));
  parts.svCursor.style.left = `${s * 100}%`;
  parts.svCursor.style.top = `${(1 - v) * 100}%`;
  parts.hueCursor.style.top = `${(h / 360) * 100}%`;
  parts.hue.setAttribute("aria-valuenow", String(Math.round(h)));
  parts.sv.setAttribute("aria-valuenow", String(Math.round(s * 100)));
  parts.sv.setAttribute(
    "aria-valuetext",
    `Saturation ${Math.round(s * 100)}%, brightness ${Math.round(v * 100)}%`
  );
  parts.wrap.style.setProperty(
    "--palette-sv-selected",
    formatColorRgbHex(hsvToRgbNumber(h, s, v))
  );
}

/** Sync cursors and hue field from an `#RRGGBB` color. */
export function setPaletteSvPickerRgb(
  parts: PaletteSvPickerElements,
  rgb: number
): BlockColorHsv {
  const hsv = rgbToHsv(clampColorRgb(rgb));
  paintPicker(parts, hsv);
  return hsv;
}

export function attachPaletteSvPickerHandlers(
  parts: PaletteSvPickerElements,
  onRgb: (rgb: number) => void,
  options?: {
    guard?: () => boolean;
    onPointerDownAccepted?: () => void;
    onPointerUpAfterRelease?: () => void;
  }
): {
  /** Local HSV while dragging; call after external `setPaletteSvPickerRgb`. */
  getHsv: () => BlockColorHsv;
  setHsv: (hsv: BlockColorHsv, emit: boolean) => void;
} {
  let hsv: BlockColorHsv = { h: 0, s: 1, v: 0.52 };
  const pass = (): boolean => options?.guard?.() !== false;

  const emit = (): void => {
    paintPicker(parts, hsv);
    onRgb(hsvToRgbNumber(hsv.h, hsv.s, hsv.v));
  };

  const bindSurface = (
    el: HTMLElement,
    apply: (x: number, y: number) => void
  ): void => {
    const pick = (ev: PointerEvent): void => {
      const { x, y } = normFromClient(el, ev.clientX, ev.clientY);
      apply(x, y);
      emit();
    };
    el.addEventListener("pointerdown", (e) => {
      if (!pass()) return;
      e.preventDefault();
      options?.onPointerDownAccepted?.();
      el.setPointerCapture(e.pointerId);
      pick(e);
    });
    el.addEventListener("pointermove", (e) => {
      if (!el.hasPointerCapture(e.pointerId)) return;
      pick(e);
    });
    const release = (e: PointerEvent): void => {
      if (!el.hasPointerCapture(e.pointerId)) return;
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
      options?.onPointerUpAfterRelease?.();
    };
    el.addEventListener("pointerup", release);
    el.addEventListener("pointercancel", release);
  };

  bindSurface(parts.sv, (x, y) => {
    hsv = { ...hsv, s: x, v: 1 - y };
  });
  bindSurface(parts.hue, (_x, y) => {
    hsv = { ...hsv, h: y * 360 };
  });

  parts.hue.addEventListener("keydown", (e) => {
    if (!pass()) return;
    let next = hsv.h;
    if (e.key === "ArrowUp" || e.key === "ArrowLeft") next -= 8;
    else if (e.key === "ArrowDown" || e.key === "ArrowRight") next += 8;
    else return;
    e.preventDefault();
    hsv = { ...hsv, h: ((next % 360) + 360) % 360 };
    emit();
  });

  parts.sv.addEventListener("keydown", (e) => {
    if (!pass()) return;
    let { s, v } = hsv;
    const step = e.shiftKey ? 0.08 : 0.04;
    if (e.key === "ArrowLeft") s -= step;
    else if (e.key === "ArrowRight") s += step;
    else if (e.key === "ArrowUp") v += step;
    else if (e.key === "ArrowDown") v -= step;
    else return;
    e.preventDefault();
    hsv = { ...hsv, s: clamp01(s), v: clamp01(v) };
    emit();
  });

  return {
    getHsv: () => ({ ...hsv }),
    setHsv: (next, shouldEmit) => {
      hsv = {
        h: ((next.h % 360) + 360) % 360,
        s: clamp01(next.s),
        v: clamp01(next.v),
      };
      if (shouldEmit) emit();
      else paintPicker(parts, hsv);
    },
  };
}
