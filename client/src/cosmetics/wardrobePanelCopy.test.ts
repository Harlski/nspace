import { describe, expect, it } from "vitest";
import {
  SHOP_ACHIEVEMENTS_ONLY_COPY,
  WARDROBE_SLOT_EMPTY_COPY,
  wardrobeSlotStatusLabel,
} from "./wardrobePanel.js";

describe("wardrobe v2 empty copy", () => {
  it("shows coming-soon copy for passive slots without owned items", () => {
    expect(
      wardrobeSlotStatusLabel({
        slot: "nameplate",
        presetName: "None",
        ownedSelectableCount: 0,
      })
    ).toBe(WARDROBE_SLOT_EMPTY_COPY);
    expect(
      wardrobeSlotStatusLabel({
        slot: "chatBubble",
        presetName: "None",
        ownedSelectableCount: 0,
      })
    ).toBe(WARDROBE_SLOT_EMPTY_COPY);
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
      wardrobeSlotStatusLabel({
        slot: "deployable",
        presetName: "None",
        ownedSelectableCount: 0,
        ownedDeployableCount: 0,
      })
    ).toBe(WARDROBE_SLOT_EMPTY_COPY);
    expect(
      wardrobeSlotStatusLabel({
        slot: "deployable",
        presetName: "None",
        ownedSelectableCount: 0,
        ownedDeployableCount: 2,
      })
    ).toBe("2 owned");
  });

  it("uses achievements-only shop messaging", () => {
    expect(SHOP_ACHIEVEMENTS_ONLY_COPY).toMatch(/Achievements/i);
  });
});
