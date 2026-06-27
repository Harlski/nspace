/** CSS swatch classes for cosmetic preset thumbnails (v1 static chips). */

export function presetSwatchClass(presetId: string, slot?: string): string {
  const base = "wardrobe-swatch";
  if (presetId.startsWith("aura-")) return `${base} ${base}--${presetId}`;
  if (presetId === "nameplate-frame-simple") return `${base} ${base}--nameplate-simple`;
  if (presetId === "nameplate-frame-neon") return `${base} ${base}--nameplate-neon`;
  if (presetId === "bubble-rounded-pastel") return `${base} ${base}--bubble-pastel`;
  if (presetId === "bubble-sharp-dark") return `${base} ${base}--bubble-dark`;
  if (presetId === "trail-sparkle") return `${base} ${base}--trail-sparkle`;
  if (presetId === "trail-smoke") return `${base} ${base}--trail-smoke`;
  if (presetId === "trail-linger-cyan") return `${base} ${base}--trail-linger-cyan`;
  if (presetId === "trail-linger-gold") return `${base} ${base}--trail-linger-gold`;
  if (presetId === "trail-linger-rose") return `${base} ${base}--trail-linger-rose`;
  if (presetId === "trail-linger-violet") return `${base} ${base}--trail-linger-violet`;
  if (presetId === "trail-linger-lime") return `${base} ${base}--trail-linger-lime`;
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
  if (presets.aura?.startsWith("aura-")) {
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
  if (presets.trail === "trail-sparkle") parts.push("wardrobe-doll__vfx--trail-sparkle");
  else if (presets.trail === "trail-smoke") parts.push("wardrobe-doll__vfx--trail-smoke");
  else if (presets.trail?.startsWith("trail-linger-")) {
    parts.push(`wardrobe-doll__vfx--${presets.trail}`);
  }
  return parts.join(" ");
}
