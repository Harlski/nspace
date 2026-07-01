import { describe, expect, it } from "vitest";
import {
  WARDROBE_SLOT_EMPTY_COPY,
  wardrobeSlotShowsEmptyIcon,
  wardrobeSlotStatusLabel,
} from "./wardrobePanel.js";

describe("wardrobe v2 empty copy", () => {
  it("uses the unavailable icon state instead of coming-soon copy", () => {
    const input = {
      slot: "nameplate" as const,
      presetName: "None",
      ownedSelectableCount: 0,
    };
    expect(wardrobeSlotShowsEmptyIcon(input)).toBe(true);
    expect(wardrobeSlotStatusLabel(input)).toBe("None");
  });

  it("keeps None for aura and trail without owned items", () => {
    expect(
      wardrobeSlotStatusLabel({
        slot: "aura",
        presetName: "None",
        ownedSelectableCount: 0,
      })
    ).toBe("None");
  });

  it("describes deployable ownership", () => {
    expect(
      wardrobeSlotShowsEmptyIcon({
        slot: "deployable",
        presetName: "None",
        ownedSelectableCount: 0,
        ownedDeployableCount: 0,
      })
    ).toBe(true);
    expect(
      wardrobeSlotStatusLabel({
        slot: "deployable",
        presetName: "None",
        ownedSelectableCount: 0,
        ownedDeployableCount: 2,
      })
    ).toBe("2 owned");
  });

  it("preserves screen-reader copy for unavailable slots", () => {
    expect(WARDROBE_SLOT_EMPTY_COPY).toMatch(/unlock/i);
  });
});
