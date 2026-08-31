import { describe, expect, it, beforeEach } from "vitest";
import { createTranslator, setSharedTranslator } from "@nspace/i18n";
import { tagHudResultView, tagHudStungCaption } from "./tagHudResult.js";

beforeEach(() => {
  setSharedTranslator(createTranslator("en"));
});

describe("tagHudResultView", () => {
  it("shows the Stung player's identicon instead of a Stung label", () => {
    expect(tagHudResultView({ type: "stung", playerId: "NQ07 BITTEN" })).toEqual({
      kind: "stung_identicon",
      playerId: "NQ07 BITTEN",
    });
  });

  it("names the Stung player next to the identicon", () => {
    expect(tagHudStungCaption("Ada")).toBe("Ada got bit by the mosquito");
  });

  it("keeps last-remaining as text", () => {
    expect(tagHudResultView({ type: "last_remaining", playerId: "NQ07 A" })).toEqual({
      kind: "last_remaining",
    });
  });
});
