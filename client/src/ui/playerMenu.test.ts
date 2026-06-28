import { describe, it, expect } from "vitest";
import { playerMenuItemLabelsForMode } from "./playerMenu.js";

describe("playerMenuItemLabelsForMode", () => {
  it("lists full-player navigation items (Shop replaces Profile)", () => {
    expect(playerMenuItemLabelsForMode(false)).toEqual([
      "Wardrobe",
      "Shop",
      "Achievements",
      "Rooms",
      "Return to Hub",
      "Logout",
    ]);
  });

  it("lists guest navigation items (no Shop, keeps Profile)", () => {
    expect(playerMenuItemLabelsForMode(true)).toEqual([
      "Profile",
      "Get a Wallet",
      "Return to Hub",
      "Leave",
    ]);
  });

  it("hides Return to Hub while already in the Hub", () => {
    expect(playerMenuItemLabelsForMode(false, false)).toEqual([
      "Wardrobe",
      "Shop",
      "Achievements",
      "Rooms",
      "Logout",
    ]);
  });

  it("surfaces Leave the Shaper at the top while inside The Shaper", () => {
    expect(playerMenuItemLabelsForMode(false, true, true)).toEqual([
      "Leave the Shaper",
      "Wardrobe",
      "Shop",
      "Achievements",
      "Rooms",
      "Return to Hub",
      "Logout",
    ]);
  });

  it("does not surface Leave the Shaper for guests", () => {
    expect(playerMenuItemLabelsForMode(true, true, true)).toEqual([
      "Profile",
      "Get a Wallet",
      "Return to Hub",
      "Leave",
    ]);
  });
});
