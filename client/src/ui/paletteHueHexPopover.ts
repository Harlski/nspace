import {
  clampColorRgb,
  formatColorRgbHexDigits,
  previewColorRgbHex,
  sanitizeHexColorDigits,
  tryParseColorRgbHex,
} from "../game/blockStyle.js";
const POPOVER_CLASS = "palette-hue-hex-popover";
export const PALETTE_HUE_HEX_INPUT_CLASS = "palette-hue-hex-popover__input";
const CORE_TRIGGER_CLASS = "palette-hue-ring__core--hex-trigger";

let popoverEl: HTMLDivElement | null = null;
let popoverInput: HTMLInputElement | null = null;
let popoverPreview: HTMLElement | null = null;
let openAnchor: HTMLElement | null = null;
let openCore: HTMLElement | null = null;
let rgbAtOpen = 0;
let getRgbOpen: (() => number) | null = null;
let onRgbPreviewOpen: ((rgb: number) => void) | null = null;
let onRgbCommitOpen: ((rgb: number) => void) | null = null;
let outsideClickListener: ((e: MouseEvent) => void) | null = null;
let escapeListener: ((e: KeyboardEvent) => void) | null = null;
let previewRaf = 0;

function popoverHexValue(): string {
  const digits = popoverInput?.value ?? "";
  return `#${digits}`;
}

function setPopoverInputDigits(digits: string): void {
  if (!popoverInput) return;
  popoverInput.value = sanitizeHexColorDigits(digits);
}

function wireHexDigitInput(input: HTMLInputElement): void {
  input.maxLength = 6;
  input.placeholder = "5b6b8c";

  input.addEventListener("beforeinput", (e) => {
    const ev = e as InputEvent;
    if (ev.isComposing) return;
    if (ev.inputType === "insertText" && typeof ev.data === "string") {
      if (!/^[0-9a-fA-F]*$/.test(ev.data)) {
        e.preventDefault();
      }
      return;
    }
  });

  input.addEventListener("paste", (e) => {
    e.preventDefault();
    const pasted = sanitizeHexColorDigits(
      e.clipboardData?.getData("text/plain") ?? ""
    );
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? start;
    const merged = sanitizeHexColorDigits(
      input.value.slice(0, start) + pasted + input.value.slice(end)
    );
    input.value = merged;
    const caret = Math.min(start + pasted.length, merged.length);
    input.setSelectionRange(caret, caret);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Backspace" && input.selectionStart === 0 && input.selectionEnd === 0) {
      e.preventDefault();
    }
  });
}

function ensurePopover(): {
  root: HTMLDivElement;
  input: HTMLInputElement;
  preview: HTMLElement;
} {
  if (popoverEl && popoverInput && popoverPreview) {
    return { root: popoverEl, input: popoverInput, preview: popoverPreview };
  }
  const root = document.createElement("div");
  root.className = POPOVER_CLASS;
  root.hidden = true;
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-label", "Custom hex color");
  const label = document.createElement("label");
  label.className = "palette-hue-hex-popover__label";
  label.textContent = "Hex color";
  const field = document.createElement("div");
  field.className = "palette-hue-hex-popover__field";
  const hash = document.createElement("span");
  hash.className = "palette-hue-hex-popover__hash";
  hash.textContent = "#";
  hash.setAttribute("aria-hidden", "true");
  const input = document.createElement("input");
  input.type = "text";
  input.className = PALETTE_HUE_HEX_INPUT_CLASS;
  input.setAttribute("spellcheck", "false");
  input.setAttribute("autocomplete", "off");
  input.setAttribute("inputmode", "latin");
  input.setAttribute("aria-label", "Hex color digits");
  wireHexDigitInput(input);
  field.append(hash, input);
  label.appendChild(field);
  const preview = document.createElement("span");
  preview.className = "palette-hue-hex-popover__preview";
  preview.setAttribute("aria-hidden", "true");
  const applyBtn = document.createElement("button");
  applyBtn.type = "button";
  applyBtn.className = "palette-hue-hex-popover__apply";
  applyBtn.textContent = "Apply";
  root.append(label, preview, applyBtn);
  document.body.appendChild(root);

  root.addEventListener("pointerdown", (e) => {
    e.stopPropagation();
  });

  const commitFromInput = (): boolean => {
    if (!popoverInput || !onRgbCommitOpen) return false;
    const parsed = tryParseColorRgbHex(popoverHexValue());
    if (parsed === null) return false;
    onRgbCommitOpen(parsed);
    setPopoverInputDigits(formatColorRgbHexDigits(parsed));
    syncPopoverPreview(parsed);
    return true;
  };

  const scheduleLivePreview = (): void => {
    if (previewRaf) cancelAnimationFrame(previewRaf);
    previewRaf = requestAnimationFrame(() => {
      previewRaf = 0;
      if (!popoverInput || !onRgbPreviewOpen || !popoverEl || popoverEl.hidden) {
        return;
      }
      const loose = previewColorRgbHex(popoverHexValue());
      if (loose === null) return;
      onRgbPreviewOpen(loose);
      syncPopoverPreview(loose);
    });
  };

  input.addEventListener("input", () => {
    const sanitized = sanitizeHexColorDigits(input.value);
    if (input.value !== sanitized) {
      const end = input.selectionEnd ?? sanitized.length;
      input.value = sanitized;
      input.setSelectionRange(end, end);
    }
    scheduleLivePreview();
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (commitFromInput()) {
        closePaletteHueHexPopover();
      }
    }
  });
  applyBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (commitFromInput()) {
      closePaletteHueHexPopover();
    }
  });

  popoverEl = root;
  popoverInput = input;
  popoverPreview = preview;
  return { root, input, preview };
}

function syncPopoverPreview(rgb: number): void {
  if (!popoverPreview) return;
  const c = clampColorRgb(rgb);
  const hex = `#${c.toString(16).padStart(6, "0")}`;
  popoverPreview.style.background = hex;
}

function layoutPopover(): void {
  if (!popoverEl || popoverEl.hidden || !openAnchor) return;
  const margin = 8;
  const ar = openAnchor.getBoundingClientRect();
  const pr = popoverEl.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let left = ar.left + ar.width / 2 - pr.width / 2;
  left = Math.max(margin, Math.min(left, vw - margin - pr.width));
  let top = ar.bottom + margin;
  if (top + pr.height > vh - margin) {
    top = ar.top - pr.height - margin;
  }
  top = Math.max(margin, Math.min(top, vh - margin - pr.height));
  popoverEl.style.left = `${left}px`;
  popoverEl.style.top = `${top}px`;
}

function detachGlobalListeners(): void {
  if (outsideClickListener) {
    document.removeEventListener("click", outsideClickListener, true);
    outsideClickListener = null;
  }
  if (escapeListener) {
    window.removeEventListener("keydown", escapeListener);
    escapeListener = null;
  }
}

function revertOpenColor(): void {
  if (onRgbPreviewOpen) onRgbPreviewOpen(rgbAtOpen);
}

export function closePaletteHueHexPopover(): void {
  detachGlobalListeners();
  if (previewRaf) {
    cancelAnimationFrame(previewRaf);
    previewRaf = 0;
  }
  if (popoverEl) popoverEl.hidden = true;
  if (openCore) {
    openCore.setAttribute("aria-expanded", "false");
    openCore = null;
  }
  openAnchor = null;
  getRgbOpen = null;
  onRgbPreviewOpen = null;
  onRgbCommitOpen = null;
}

export function isPaletteHueHexPopoverOpen(): boolean {
  return popoverEl !== null && !popoverEl.hidden;
}

/** True while the hex field is focused (block global build hotkeys except Escape). */
export function isPaletteHueHexPopoverTyping(): boolean {
  const ae = document.activeElement;
  return (
    ae instanceof HTMLInputElement &&
    ae.classList.contains(PALETTE_HUE_HEX_INPUT_CLASS)
  );
}

export function openPaletteHueHexPopover(opts: {
  anchor: HTMLElement;
  core: HTMLElement;
  getRgb: () => number;
  onRgbPreview: (rgb: number) => void;
  onRgbCommit: (rgb: number) => void;
}): void {
  const { root, input, preview } = ensurePopover();
  const rgb = clampColorRgb(opts.getRgb());
  rgbAtOpen = rgb;
  openAnchor = opts.anchor;
  openCore = opts.core;
  getRgbOpen = opts.getRgb;
  onRgbPreviewOpen = opts.onRgbPreview;
  onRgbCommitOpen = opts.onRgbCommit;
  setPopoverInputDigits(formatColorRgbHexDigits(rgb));
  syncPopoverPreview(rgb);
  root.hidden = false;
  opts.core.setAttribute("aria-expanded", "true");
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      layoutPopover();
      input.focus();
      input.select();
    });
  });

  detachGlobalListeners();
  outsideClickListener = (e: MouseEvent) => {
    const t = e.target as Node;
    if (root.contains(t) || opts.anchor.contains(t)) return;
    const parsed = tryParseColorRgbHex(popoverHexValue());
    if (parsed !== null) {
      onRgbCommitOpen?.(parsed);
    } else {
      revertOpenColor();
    }
    closePaletteHueHexPopover();
  };
  document.addEventListener("click", outsideClickListener, true);
  escapeListener = (e: KeyboardEvent) => {
    if (e.key !== "Escape") return;
    revertOpenColor();
    closePaletteHueHexPopover();
  };
  window.addEventListener("keydown", escapeListener);
}

/** Click a control to enter a custom `#RRGGBB` color (popover anchored to `anchor`). */
export function attachPaletteHueHexTrigger(opts: {
  anchor: HTMLElement;
  getRgb: () => number;
  onRgbPreview: (rgb: number) => void;
  onRgbCommit: (rgb: number) => void;
  guard?: () => boolean;
  triggerTitle?: string;
  triggerAriaLabel?: string;
  triggerClass?: string;
}): void {
  const { anchor } = opts;
  if (opts.triggerClass) anchor.classList.add(opts.triggerClass);
  if (opts.triggerTitle) anchor.title = opts.triggerTitle;
  anchor.setAttribute(
    "aria-label",
    opts.triggerAriaLabel ?? "Custom hex color"
  );
  anchor.setAttribute("aria-haspopup", "dialog");
  anchor.setAttribute("aria-expanded", "false");

  const open = (): void => {
    if (opts.guard?.() === false) return;
    if (isPaletteHueHexPopoverOpen() && openAnchor === anchor) {
      closePaletteHueHexPopover();
      return;
    }
    closePaletteHueHexPopover();
    openPaletteHueHexPopover({
      anchor,
      core: anchor,
      getRgb: opts.getRgb,
      onRgbPreview: opts.onRgbPreview,
      onRgbCommit: opts.onRgbCommit,
    });
  };

  anchor.addEventListener("pointerdown", (e) => {
    e.stopPropagation();
  });
  anchor.addEventListener("click", (e) => {
    e.stopPropagation();
    open();
  });
  anchor.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.stopPropagation();
      open();
    }
  });
}

/** Click the hue ring center to enter a custom `#RRGGBB` color. */
export function attachPaletteHueRingHexPopover(opts: {
  wrap: HTMLElement;
  core: HTMLElement;
  getRgb: () => number;
  onRgbPreview: (rgb: number) => void;
  onRgbCommit: (rgb: number) => void;
  guard?: () => boolean;
  triggerTitle?: string;
  triggerAriaLabel?: string;
}): void {
  const { core, wrap } = opts;
  core.classList.add(CORE_TRIGGER_CLASS);
  core.setAttribute("role", "button");
  core.setAttribute("tabindex", "0");
  core.setAttribute("aria-haspopup", "dialog");
  core.setAttribute("aria-expanded", "false");
  if (opts.triggerTitle) core.title = opts.triggerTitle;
  core.setAttribute(
    "aria-label",
    opts.triggerAriaLabel ?? "Custom hex color"
  );
  core.removeAttribute("aria-hidden");

  const open = (): void => {
    if (opts.guard?.() === false) return;
    if (isPaletteHueHexPopoverOpen() && openCore === core) {
      closePaletteHueHexPopover();
      return;
    }
    closePaletteHueHexPopover();
    openPaletteHueHexPopover({
      anchor: wrap,
      core,
      getRgb: opts.getRgb,
      onRgbPreview: opts.onRgbPreview,
      onRgbCommit: opts.onRgbCommit,
    });
  };

  core.addEventListener("pointerdown", (e) => {
    e.stopPropagation();
  });
  core.addEventListener("click", (e) => {
    e.stopPropagation();
    open();
  });
  core.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.stopPropagation();
      open();
    }
  });
}
