import { afterEach, describe, expect, it } from "vitest";
import {
  appendTextWithFlags,
  mosquitoAssetUrl,
  setMosquitoTwemojiOverrideForTests,
} from "./flags.js";
import { MOSQUITO_EMOJI } from "./emoteWheelEmotes.js";

afterEach(() => {
  setMosquitoTwemojiOverrideForTests(null);
});

describe("appendTextWithFlags", () => {
  it("leaves mosquito as system text when the glyph is available", () => {
    setMosquitoTwemojiOverrideForTests(false);
    const parent = document.createElement("div");
    appendTextWithFlags(parent, `hello ${MOSQUITO_EMOJI} there`);
    expect(parent.querySelector("img")).toBeNull();
    expect(parent.textContent).toBe(`hello ${MOSQUITO_EMOJI} there`);
  });

  it("renders mosquito as Twemoji when the glyph is missing", () => {
    setMosquitoTwemojiOverrideForTests(true);
    const parent = document.createElement("div");
    appendTextWithFlags(parent, `hello ${MOSQUITO_EMOJI} there`);
    expect(parent.childNodes).toHaveLength(3);
    expect(parent.childNodes[0]?.textContent).toBe("hello ");
    expect((parent.childNodes[1] as HTMLImageElement).getAttribute("src")).toBe(
      mosquitoAssetUrl()
    );
    expect(parent.childNodes[2]?.textContent).toBe(" there");
  });

  it("still renders a country flag as a Twemoji image", () => {
    const parent = document.createElement("div");
    appendTextWithFlags(parent, "🇧🇷");
    const img = parent.querySelector("img");
    expect(img?.getAttribute("src")).toBe("/flags/br.svg");
  });
});
