import { describe, it, expect, afterEach, vi } from "vitest";
import {
  isMobilePlayLayoutPortrait,
  isMobilePortraitViewport,
  isViewportPortrait,
} from "./pseudoFullscreen.js";

describe("isMobilePlayLayoutPortrait", () => {
  afterEach(() => {
    document.documentElement.classList.remove("nspace-mobile-play-host");
  });

  it("uses viewport aspect during rotation (not matchMedia alone)", () => {
    // Mid-rotation: OS reports landscape but dimensions are still portrait.
    expect(isMobilePlayLayoutPortrait(390, 844)).toBe(true);
    expect(isMobilePlayLayoutPortrait(844, 390)).toBe(false);
  });

  it("matches isMobilePortraitViewport for typical phone sizes", () => {
    expect(isMobilePlayLayoutPortrait(390, 844)).toBe(
      isMobilePortraitViewport(390, 844)
    );
    expect(isMobilePlayLayoutPortrait(844, 390)).toBe(
      isMobilePortraitViewport(844, 390)
    );
  });
});

describe("isViewportPortrait vs layout portrait", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("matchMedia can disagree with measured aspect (why layout avoids it on Pay)", () => {
    vi.stubGlobal("window", {
      matchMedia: (q: string) => ({
        matches: q.includes("portrait"),
      }),
      innerWidth: 844,
      innerHeight: 390,
      visualViewport: null,
    });
    expect(isViewportPortrait(844, 390)).toBe(true);
    expect(isMobilePlayLayoutPortrait(844, 390)).toBe(false);
  });
});
