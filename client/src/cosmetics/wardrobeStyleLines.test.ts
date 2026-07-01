import { describe, expect, it } from "vitest";
import {
  isMultiVariantStyleLine,
  listStyleLinesForSlot,
  representativePresetForStyleLine,
  resolveStyleLineVariants,
  styleLineForPreset,
  WARDROBE_VARIANT_UNLOCK_HINT,
} from "./wardrobeStyleLines.js";

describe("wardrobeStyleLines", () => {
  it("lists trail and aura style lines in registry order", () => {
    expect(listStyleLinesForSlot("trail").map((l) => l.id)).toEqual(["spark-path"]);
    expect(listStyleLinesForSlot("aura").map((l) => l.id)).toEqual(["magic-ring", "sigil"]);
  });

  it("maps presets to their style line", () => {
    expect(styleLineForPreset("trail-ref-spark-rose")?.id).toBe("spark-path");
    expect(styleLineForPreset("aura-ref-sigil-magic-01")?.id).toBe("sigil");
    expect(styleLineForPreset("aura-ref-magic-ring")?.id).toBe("magic-ring");
  });

  it("marks multi-variant lines", () => {
    const spark = listStyleLinesForSlot("trail")[0]!;
    const ring = listStyleLinesForSlot("aura")[0]!;
    const sigil = listStyleLinesForSlot("aura")[1]!;
    expect(isMultiVariantStyleLine(spark)).toBe(true);
    expect(isMultiVariantStyleLine(sigil)).toBe(true);
    expect(isMultiVariantStyleLine(ring)).toBe(false);
  });

  it("resolves ownership from shop and entitlements", () => {
    const spark = listStyleLinesForSlot("trail")[0]!;
    const variants = resolveStyleLineVariants(
      spark,
      [
        {
          cosmeticSku: "trail-rose",
          presetId: "trail-ref-spark-rose",
          slot: "trail",
          displayName: "Spark Path: Rose",
          description: "",
          collection: "Achievements",
          priceLuna: "0",
        },
      ],
      new Set(["trail-rose"])
    );
    const rose = variants.find((v) => v.presetId === "trail-ref-spark-rose");
    const cyan = variants.find((v) => v.presetId === "trail-ref-spark-cyan");
    expect(rose?.owned).toBe(true);
    expect(cyan?.owned).toBe(false);
    expect(cyan?.cosmeticSku).toBeNull();
  });

  it("picks a representative swatch preset for the style-line row", () => {
    const spark = listStyleLinesForSlot("trail")[0]!;
    const variants = resolveStyleLineVariants(spark, [], new Set());
    expect(
      representativePresetForStyleLine(spark, variants, "trail-ref-spark-lime")
    ).toBe("trail-ref-spark-lime");
    expect(representativePresetForStyleLine(spark, variants, null)).toBe(
      "trail-ref-spark-path"
    );
  });

  it("exposes unlock hint copy", () => {
    expect(WARDROBE_VARIANT_UNLOCK_HINT).toMatch(/achievement/i);
  });
});
