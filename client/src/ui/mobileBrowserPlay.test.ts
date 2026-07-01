import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isCoarsePointerDevice,
  isMobileBrowserPlayFallbackActive,
  shouldUseMobileBrowserPlay,
} from "./mobileBrowserPlay.js";
import { isMobilePortraitViewport, isViewportPortrait } from "./pseudoFullscreen.js";

describe("isViewportPortrait", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("prefers matchMedia orientation when available", () => {
    vi.stubGlobal("window", {
      matchMedia: (q: string) => ({
        matches: q.includes("portrait"),
      }),
      innerWidth: 844,
      innerHeight: 390,
      visualViewport: null,
    });
    expect(isViewportPortrait(844, 390)).toBe(true);
  });

  it("falls back to aspect ratio when orientation media query is unknown", () => {
    vi.stubGlobal("window", {
      matchMedia: () => ({ matches: false }),
      innerWidth: 390,
      innerHeight: 844,
      visualViewport: null,
    });
    expect(isViewportPortrait(390, 844)).toBe(true);
  });
});

describe("isMobilePortraitViewport", () => {
  it("treats narrower-than-16:9 viewports as portrait", () => {
    expect(isMobilePortraitViewport(390, 844)).toBe(true);
    expect(isMobilePortraitViewport(844, 390)).toBe(false);
  });
});

describe("shouldUseMobileBrowserPlay", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("is false on fine-pointer desktop", () => {
    vi.stubGlobal("window", {
      matchMedia: () => ({ matches: false }),
      nimiqPay: undefined,
      location: { search: "" },
    });
    expect(isCoarsePointerDevice()).toBe(false);
    expect(shouldUseMobileBrowserPlay()).toBe(false);
  });

  it("is true on coarse-pointer mobile when fallback is off", () => {
    vi.stubGlobal("window", {
      matchMedia: () => ({ matches: true }),
      nimiqPay: undefined,
      location: { search: "" },
    });
    vi.stubEnv("VITE_MOBILE_BROWSER_PLAY", undefined);
    expect(shouldUseMobileBrowserPlay()).toBe(true);
  });

  it("is false inside Nimiq Pay", () => {
    vi.stubGlobal("window", {
      matchMedia: () => ({ matches: true }),
      nimiqPay: {},
      location: { search: "" },
    });
    expect(shouldUseMobileBrowserPlay()).toBe(false);
  });

  it("honours VITE_MOBILE_BROWSER_PLAY=0 fallback", () => {
    vi.stubGlobal("window", {
      matchMedia: () => ({ matches: true }),
      nimiqPay: undefined,
      location: { search: "" },
    });
    vi.stubEnv("VITE_MOBILE_BROWSER_PLAY", "0");
    expect(isMobileBrowserPlayFallbackActive()).toBe(true);
    expect(shouldUseMobileBrowserPlay()).toBe(false);
  });
});
