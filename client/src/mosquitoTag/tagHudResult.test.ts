import { describe, expect, it } from "vitest";
import { tagHudResultView } from "./tagHudResult.js";

describe("tagHudResultView", () => {
  it("shows the Stung player's identicon instead of a Stung label", () => {
    expect(tagHudResultView({ type: "stung", playerId: "NQ07 BITTEN" })).toEqual({
      kind: "stung_identicon",
      playerId: "NQ07 BITTEN",
    });
  });

  it("keeps last-remaining as text", () => {
    expect(tagHudResultView({ type: "last_remaining", playerId: "NQ07 A" })).toEqual({
      kind: "last_remaining",
    });
  });
});
