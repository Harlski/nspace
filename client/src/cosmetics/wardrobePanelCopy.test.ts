import { describe, expect, it } from "vitest";
import {
  WARDROBE_SLOT_EMPTY_COPY,
  wardrobeSlotShowsEmptyIcon,
  wardrobeSlotStatusLabel,
} from "./wardrobePanel.js";

describe("wardrobe empty slot status", () => {
  it("treats unequipped nameplate/chatBubble like aura (no coming-soon stop icon)", () => {
    for (const slot of ["nameplate", "chatBubble", "aura", "trail"] as const) {
      const input = {
        slot,
        presetName: "None" as const,
        ownedSelectableCount: 0,
      };
      expect(wardrobeSlotShowsEmptyIcon(input)).toBe(false);
      expect(wardrobeSlotStatusLabel(input)).toBe("None");
    }
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

  it("keeps empty-slot screen-reader copy available for deployables", () => {
    expect(WARDROBE_SLOT_EMPTY_COPY).toMatch(/unlock/i);
  });
});
