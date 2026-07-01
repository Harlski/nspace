/** CSS swatch classes and Kenney sprite thumbnails for cosmetic presets. */

import {
  cosmeticPresetPreviewSpriteUrl,
  cosmeticPresetPreviewTint,
  getCosmeticPrefabDef,
  isAuraPrefabDef,
  isTrailPrefabDef,
} from "./cosmeticPrefabRegistry.js";
import { tintedKenneySpriteDataUrl } from "./cosmeticSwatchTint.js";
import { nimiqHexLoaderSvg } from "../ui/nimiqHexLoader.js";

export function presetSwatchClass(presetId: string, slot?: string): string {
  const base = "wardrobe-swatch";
  if (presetId.startsWith("aura-ref-") || presetId.startsWith("aura-kenney-")) {
    return `${base} ${base}--${presetId}`;
  }
  if (presetId.startsWith("trail-ref-") || presetId.startsWith("trail-kenney-")) {
    return `${base} ${base}--${presetId}`;
  }
  if (presetId === "nameplate-frame-simple") return `${base} ${base}--nameplate-simple`;
  if (presetId === "nameplate-frame-neon") return `${base} ${base}--nameplate-neon`;
  if (presetId === "bubble-rounded-pastel") return `${base} ${base}--bubble-pastel`;
  if (presetId === "bubble-sharp-dark") return `${base} ${base}--bubble-dark`;
  if (presetId === "deployable-confetti-burst") return `${base} ${base}--deployable`;
  if (slot === "deployable") return `${base} ${base}--deployable`;
  return base;
}

export type PassiveSlotId = "aura" | "nameplate" | "chatBubble" | "trail";

export const PASSIVE_SLOTS: readonly PassiveSlotId[] = [
  "nameplate",
  "aura",
  "chatBubble",
  "trail",
] as const;

export const SLOT_LABELS: Record<PassiveSlotId, string> = {
  nameplate: "Nameplate",
  aura: "Aura",
  chatBubble: "Chat bubble",
  trail: "Trail",
};

export function loadoutSkuKey(slot: PassiveSlotId): keyof {
  auraSku: string | null;
  nameplateSku: string | null;
  chatBubbleSku: string | null;
  trailSku: string | null;
} {
  if (slot === "chatBubble") return "chatBubbleSku";
  return `${slot}Sku` as "auraSku" | "nameplateSku" | "trailSku";
}

function usesSpritePreview(presetId: string, slot?: string): boolean {
  if (slot === "trail" || slot === "aura") return cosmeticPresetPreviewSpriteUrl(presetId) !== null;
  const def = getCosmeticPrefabDef(presetId);
  if (!def) return false;
  return isTrailPrefabDef(def) || isAuraPrefabDef(def);
}

function swatchLoaderMarkup(): string {
  return `<span class="wardrobe-swatch__loader">${nimiqHexLoaderSvg("wardrobe-swatch__hex-loader")}</span>`;
}

function bindTintedSprite(
  el: HTMLSpanElement,
  img: HTMLImageElement,
  url: string,
  tint: number | null
): void {
  const finish = (): void => {
    el.classList.remove("is-loading");
  };
  img.addEventListener("load", finish, { once: true });
  img.addEventListener("error", finish, { once: true });

  const apply = (src: string): void => {
    if (img.src !== src) img.src = src;
  };

  if (tint === null) {
    apply(url);
    return;
  }
  void tintedKenneySpriteDataUrl(url, tint)
    .then(apply)
    .catch(() => apply(url));
}

function appendSpritePreview(
  el: HTMLSpanElement,
  presetId: string,
  slot?: PassiveSlotId | string
): void {
  const url = cosmeticPresetPreviewSpriteUrl(presetId);
  if (!url || !usesSpritePreview(presetId, slot)) return;

  el.classList.add("wardrobe-swatch--sprite", "is-loading");
  el.dataset.presetId = presetId;

  const loader = document.createElement("span");
  loader.className = "wardrobe-swatch__loader";
  loader.innerHTML = nimiqHexLoaderSvg("wardrobe-swatch__hex-loader");

  const img = document.createElement("img");
  img.className = "wardrobe-swatch__sprite";
  img.alt = "";
  img.decoding = "async";

  el.append(loader, img);
  bindTintedSprite(el, img, url, cosmeticPresetPreviewTint(presetId));
}

const COSMETIC_LOCKED_SLOT_ICON = "/assets/cosmetics/locked-slot.png";

/** Padlock - slot has no unlockable cosmetics yet. */
export function createUnavailableIcon(): HTMLSpanElement {
  const icon = document.createElement("span");
  icon.className = "wardrobe-slot__unavailable-icon";
  icon.setAttribute("aria-hidden", "true");
  const img = document.createElement("img");
  img.className = "wardrobe-slot__unavailable-icon-img";
  img.src = COSMETIC_LOCKED_SLOT_ICON;
  img.alt = "";
  img.decoding = "async";
  icon.appendChild(img);
  return icon;
}

export function createUnavailableSwatch(): HTMLSpanElement {
  const el = document.createElement("span");
  el.className = "wardrobe-swatch wardrobe-swatch--unavailable";
  el.setAttribute("aria-hidden", "true");
  el.appendChild(createUnavailableIcon());
  return el;
}

/** Padlock overlay for locked Style Variants in the Variant Picker grid. */
export function appendLockedVariantOverlay(host: HTMLElement): void {
  const overlay = document.createElement("span");
  overlay.className = "wardrobe-variant-tile__lock";
  overlay.setAttribute("aria-hidden", "true");
  const img = document.createElement("img");
  img.className = "wardrobe-variant-tile__lock-img";
  img.src = COSMETIC_LOCKED_SLOT_ICON;
  img.alt = "";
  img.decoding = "async";
  overlay.appendChild(img);
  host.appendChild(overlay);
}

/** Wardrobe / shop list chip - tinted Kenney sprite for v2 trail and aura prefabs. */
export function createPresetSwatch(
  presetId: string | null,
  slot?: PassiveSlotId | string,
  opts?: { locked?: boolean }
): HTMLSpanElement {
  const el = document.createElement("span");
  el.setAttribute("aria-hidden", "true");
  if (!presetId) {
    el.className = "wardrobe-swatch wardrobe-swatch--empty";
    return el;
  }
  el.className = presetSwatchClass(presetId, slot);
  appendSpritePreview(el, presetId, slot);
  if (opts?.locked) appendLockedVariantOverlay(el);
  return el;
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}

/** Static HTML for achievement reward icons and other string templates. */
export function presetSwatchMarkup(
  presetId: string,
  slot?: PassiveSlotId | string,
  extraClass = ""
): string {
  const classes = [presetSwatchClass(presetId, slot), extraClass].filter(Boolean).join(" ");
  const url = cosmeticPresetPreviewSpriteUrl(presetId);
  if (url && usesSpritePreview(presetId, slot)) {
    return (
      `<span class="${escHtml(classes)} wardrobe-swatch--sprite is-loading" data-preset-id="${escHtml(presetId)}" aria-hidden="true">` +
      `${swatchLoaderMarkup()}<img class="wardrobe-swatch__sprite" alt="" decoding="async" /></span>`
    );
  }
  return `<span class="${escHtml(classes)}" aria-hidden="true"></span>`;
}

/** Apply async tint + hide Nimiq loader on swatches rendered from {@link presetSwatchMarkup}. */
export function hydratePresetSwatches(root: ParentNode): void {
  root.querySelectorAll<HTMLSpanElement>(".wardrobe-swatch--sprite[data-preset-id]").forEach((el) => {
    if (el.dataset.hydrated === "1") return;
    const presetId = el.dataset.presetId;
    if (!presetId) return;
    const img = el.querySelector<HTMLImageElement>("img.wardrobe-swatch__sprite");
    const url = cosmeticPresetPreviewSpriteUrl(presetId);
    if (!img || !url) return;
    el.dataset.hydrated = "1";
    bindTintedSprite(el, img, url, cosmeticPresetPreviewTint(presetId));
  });
}

export function dollVfxClasses(presets: Partial<Record<PassiveSlotId, string | null>>): string {
  const parts = ["wardrobe-doll__vfx"];
  if (presets.aura?.startsWith("aura-ref-") || presets.aura?.startsWith("aura-kenney-")) {
    parts.push(`wardrobe-doll__vfx--${presets.aura}`);
  }
  if (presets.nameplate === "nameplate-frame-simple") {
    parts.push("wardrobe-doll__vfx--nameplate-simple");
  } else if (presets.nameplate === "nameplate-frame-neon") {
    parts.push("wardrobe-doll__vfx--nameplate-neon");
  }
  if (presets.chatBubble === "bubble-rounded-pastel") {
    parts.push("wardrobe-doll__vfx--bubble-pastel");
  } else if (presets.chatBubble === "bubble-sharp-dark") {
    parts.push("wardrobe-doll__vfx--bubble-dark");
  }
  if (presets.trail?.startsWith("trail-ref-") || presets.trail?.startsWith("trail-kenney-")) {
    parts.push(`wardrobe-doll__vfx--${presets.trail}`);
  }
  return parts.join(" ");
}
