import { describe, expect, it } from "vitest";
import { createPresetSwatch, createUnavailableSwatch } from "./presetSwatch.js";

describe("createPresetSwatch", () => {
  it("uses Kenney sprite thumbnails for trail and aura prefabs", () => {
    for (const [presetId, slot] of [
      ["trail-ref-spark-rose", "trail"],
      ["aura-ref-sigil-magic-01", "aura"],
    ] as const) {
      const el = createPresetSwatch(presetId, slot);
      expect(el.classList.contains("wardrobe-swatch--sprite")).toBe(true);
      expect(el.querySelector("img.wardrobe-swatch__sprite")).toBeTruthy();
    }
  });
});

describe("createUnavailableSwatch", () => {
  it("shows the locked-slot padlock icon", () => {
    const el = createUnavailableSwatch();
    expect(el.classList.contains("wardrobe-swatch--unavailable")).toBe(true);
    const img = el.querySelector("img.wardrobe-slot__unavailable-icon-img");
    expect(img?.getAttribute("src")).toContain("locked-slot.png");
  });
});
