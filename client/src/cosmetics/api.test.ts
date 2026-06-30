import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const WARDROBE_PAYLOAD = {
  entitlements: [],
  loadout: {
    auraSku: null,
    nameplateSku: null,
    chatBubbleSku: null,
    trailSku: null,
  },
  shop: [],
  featured: [],
};

describe("fetchWardrobe", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => WARDROBE_PAYLOAD,
      }))
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function loadCosmeticsApi() {
    vi.doMock("../auth/session.js", () => ({
      loadCachedSession: () => ({ token: "test-token" }),
    }));
    vi.doMock("../net/apiBase.js", () => ({
      apiUrl: (path: string) => path,
    }));
    return import("./api.js");
  }

  it("coalesces concurrent wardrobe fetches into one HTTP request", async () => {
    const { fetchWardrobe } = await loadCosmeticsApi();
    await Promise.all([fetchWardrobe(), fetchWardrobe(), fetchWardrobe()]);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("reuses session cache for sequential opens within the cache window", async () => {
    const { fetchWardrobe } = await loadCosmeticsApi();
    for (let i = 0; i < 5; i++) {
      await fetchWardrobe();
    }
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("refetches after invalidateWardrobeCache", async () => {
    const { fetchWardrobe, invalidateWardrobeCache } = await loadCosmeticsApi();
    await fetchWardrobe();
    invalidateWardrobeCache();
    await fetchWardrobe();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("refetches when force is true even with a warm cache", async () => {
    const { fetchWardrobe } = await loadCosmeticsApi();
    await fetchWardrobe();
    await fetchWardrobe({ force: true });
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
