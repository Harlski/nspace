/** Style Line grouping for Wardrobe slot dropdowns (trail / aura v2 prefabs). */

import type { ShopEntry } from "./api.js";
import {
  AURA_SIGIL_SPRITES,
  TRAIL_SPARK_COLORS,
} from "./cosmeticPrefabRegistry.js";
import type { PassiveSlotId } from "./presetSwatch.js";

export type StyleVariantDef = {
  presetId: string;
  variantKey: string;
  variantLabel: string;
};

export type StyleLineDef = {
  id: string;
  label: string;
  slot: PassiveSlotId;
  /** Header inside the Variant Picker drill-in view. */
  variantPickerTitle: string;
  sortOrder: number;
  variants: readonly StyleVariantDef[];
};

export type ResolvedStyleVariant = {
  presetId: string;
  variantLabel: string;
  displayName: string;
  cosmeticSku: string | null;
  owned: boolean;
  shopEntry?: ShopEntry;
};

const TRAIL_SPARK_VARIANT_ORDER = ["gold", "cyan", "rose", "violet", "lime"] as const;

const SPARK_PATH_LINE: StyleLineDef = {
  id: "spark-path",
  label: "Spark Path",
  slot: "trail",
  variantPickerTitle: "Choose colour",
  sortOrder: 0,
  variants: TRAIL_SPARK_VARIANT_ORDER.map((key) => {
    const c = TRAIL_SPARK_COLORS[key];
    const presetId =
      key === "gold" ? "trail-ref-spark-path" : `trail-ref-spark-${c.id}`;
    return {
      presetId,
      variantKey: c.id,
      variantLabel: key === "gold" ? "Gold" : c.label.replace(/^Spark Path: /, ""),
    };
  }),
};

const MAGIC_RING_LINE: StyleLineDef = {
  id: "magic-ring",
  label: "Magic Ring",
  slot: "aura",
  variantPickerTitle: "Choose variant",
  sortOrder: 0,
  variants: [
    {
      presetId: "aura-ref-magic-ring",
      variantKey: "magic-ring",
      variantLabel: "Magic Ring",
    },
  ],
};

const SIGIL_LINE: StyleLineDef = {
  id: "sigil",
  label: "Sigil",
  slot: "aura",
  variantPickerTitle: "Choose sigil",
  sortOrder: 1,
  variants: AURA_SIGIL_SPRITES.map((s) => ({
    presetId: `aura-ref-sigil-${s.slug}`,
    variantKey: s.slug,
    variantLabel: s.label,
  })),
};

const STYLE_LINES: readonly StyleLineDef[] = [
  SPARK_PATH_LINE,
  MAGIC_RING_LINE,
  SIGIL_LINE,
];

const STYLE_LINE_BY_ID = new Map(STYLE_LINES.map((line) => [line.id, line]));
const STYLE_LINE_BY_PRESET = new Map<string, StyleLineDef>();

for (const line of STYLE_LINES) {
  for (const variant of line.variants) {
    STYLE_LINE_BY_PRESET.set(variant.presetId, line);
  }
}

export const WARDROBE_VARIANT_UNLOCK_HINT = "Unlock via Achievements";

export function isGroupedStyleSlot(slot: PassiveSlotId): boolean {
  return slot === "trail" || slot === "aura";
}

export function listStyleLinesForSlot(slot: PassiveSlotId): StyleLineDef[] {
  return STYLE_LINES.filter((line) => line.slot === slot).sort(
    (a, b) => a.sortOrder - b.sortOrder
  );
}

export function styleLineForPreset(presetId: string): StyleLineDef | null {
  return STYLE_LINE_BY_PRESET.get(presetId) ?? null;
}

export function styleLineById(styleLineId: string): StyleLineDef | null {
  return STYLE_LINE_BY_ID.get(styleLineId) ?? null;
}

export function isMultiVariantStyleLine(line: StyleLineDef): boolean {
  return line.variants.length > 1;
}

export function resolveStyleLineVariants(
  line: StyleLineDef,
  shop: ShopEntry[],
  ownedSkus: ReadonlySet<string>
): ResolvedStyleVariant[] {
  return line.variants.map((variant) => {
    const shopEntry = shop.find((s) => s.presetId === variant.presetId);
    const cosmeticSku = shopEntry?.cosmeticSku ?? null;
    const owned = cosmeticSku !== null && ownedSkus.has(cosmeticSku);
    return {
      presetId: variant.presetId,
      variantLabel: variant.variantLabel,
      displayName: shopEntry?.displayName ?? `${line.label}: ${variant.variantLabel}`,
      cosmeticSku,
      owned,
      shopEntry,
    };
  });
}

/** Swatch preset for a style-line row - equipped/preview variant, else first owned, else first. */
export function representativePresetForStyleLine(
  line: StyleLineDef,
  variants: ResolvedStyleVariant[],
  activePresetId: string | null
): string {
  if (activePresetId && line.variants.some((v) => v.presetId === activePresetId)) {
    return activePresetId;
  }
  const owned = variants.find((v) => v.owned);
  if (owned) return owned.presetId;
  return line.variants[0]?.presetId ?? variants[0]?.presetId ?? "";
}
