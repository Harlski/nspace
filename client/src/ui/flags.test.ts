import { describe, expect, it } from "vitest";
import {
  appendTextWithFlags,
  isSoleMosquitoEmoji,
  layoutLineWithMosquitoGlyphs,
  MOSQUITO_EMOJI,
  mosquitoAssetUrl,
} from "./flags.js";

describe("appendTextWithFlags", () => {
  it("renders a pasted mosquito emoji as a Twemoji image", () => {
    const parent = document.createElement("div");
    appendTextWithFlags(parent, MOSQUITO_EMOJI);
    const img = parent.querySelector("img");
    expect(img).not.toBeNull();
    expect(img?.getAttribute("src")).toBe(mosquitoAssetUrl());
    expect(parent.childNodes).toHaveLength(1);
  });

  it("keeps surrounding text when a mosquito is mixed into a chat line", () => {
    const parent = document.createElement("div");
    appendTextWithFlags(parent, `hello ${MOSQUITO_EMOJI} there`);
    expect(parent.childNodes).toHaveLength(3);
    expect(parent.childNodes[0]?.textContent).toBe("hello ");
    expect((parent.childNodes[1] as HTMLImageElement).src).toContain("1f99f");
    expect(parent.childNodes[2]?.textContent).toBe(" there");
  });

  it("still renders a country flag as a Twemoji image", () => {
    const parent = document.createElement("div");
    appendTextWithFlags(parent, "🇧🇷");
    const img = parent.querySelector("img");
    expect(img?.getAttribute("src")).toBe("/flags/br.svg");
  });
});

describe("isSoleMosquitoEmoji", () => {
  it("is true only for a lone mosquito glyph", () => {
    expect(isSoleMosquitoEmoji(MOSQUITO_EMOJI)).toBe(true);
    expect(isSoleMosquitoEmoji(` ${MOSQUITO_EMOJI} `)).toBe(true);
    expect(isSoleMosquitoEmoji(`hi ${MOSQUITO_EMOJI}`)).toBe(false);
  });
});

describe("layoutLineWithMosquitoGlyphs", () => {
  it("splits mixed bubble text so the mosquito is its own glyph slot", () => {
    const layout = layoutLineWithMosquitoGlyphs(
      `hi ${MOSQUITO_EMOJI}`,
      (s) => s.length * 10,
      24
    );
    expect(layout.segs).toEqual([
      { kind: "text", text: "hi ", width: 30 },
      { kind: "mosquito", width: 24 },
    ]);
    expect(layout.totalWidth).toBe(54);
  });
});
