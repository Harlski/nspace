/** CSS swatch classes for cosmetic preset thumbnails. */

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
