import { describe, expect, it } from "vitest";
import { profileFlagChipLabels } from "./profileFlagChip.js";

describe("profileFlagChipLabels", () => {
  it("uses the country name for hover and the accessible name on another player's chip", () => {
    expect(profileFlagChipLabels("other", "Brazil")).toEqual({
      title: "Brazil",
      ariaLabel: "Brazil",
    });
  });

  it("keeps hover as the country name on your own chip and names the change action for assistive tech", () => {
    expect(profileFlagChipLabels("self", "Brazil")).toEqual({
      title: "Brazil",
      ariaLabel: "Brazil. Change your country.",
    });
  });

  it("prompts you to pick a country when your own chip has none", () => {
    expect(profileFlagChipLabels("self", null)).toEqual({
      title: "Pick your country",
      ariaLabel: "Pick your country",
    });
  });

  it("has no labels when another player's chip has no country", () => {
    expect(profileFlagChipLabels("other", null)).toBeNull();
  });
});
