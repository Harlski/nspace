import { describe, it, expect } from "vitest";
import { playerMenuItemLabelsForMode } from "./playerMenu.js";

describe("playerMenuItemLabelsForMode", () => {
  it("lists full-player navigation items", () => {
    expect(playerMenuItemLabelsForMode(false)).toEqual([
      "Profile",
      "Wardrobe",
      "Achievements",
      "Rooms",
      "Return to Hub",
      "Logout",
    ]);
  });

  it("lists guest navigation items", () => {
    expect(playerMenuItemLabelsForMode(true)).toEqual([
      "Profile",
      "Get a Wallet",
      "Return to Hub",
      "Leave",
    ]);
  });

  it("hides Return to Hub while already in the Hub", () => {
    expect(playerMenuItemLabelsForMode(false, false)).toEqual([
      "Profile",
      "Wardrobe",
      "Achievements",
      "Rooms",
      "Logout",
    ]);
  });
});
