import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ACH_PAYLOAD = {
  totalPoints: 42,
  telescopeUnlocked: false,
  achievements: [],
};

describe("fetchMyAchievements", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ACH_PAYLOAD,
      }))
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function loadAchievementsApi() {
    vi.doMock("../auth/session.js", () => ({
      loadCachedSession: () => ({ token: "test-token" }),
    }));
    vi.doMock("../net/apiBase.js", () => ({
      apiUrl: (path: string) => path,
    }));
    return import("./api.js");
  }

  it("coalesces concurrent achievement fetches into one HTTP request", async () => {
    const { fetchMyAchievements } = await loadAchievementsApi();
    await Promise.all([
      fetchMyAchievements(),
      fetchMyAchievements(),
      fetchMyAchievements(),
    ]);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("reuses session cache for sequential opens within the cache window", async () => {
    const { fetchMyAchievements } = await loadAchievementsApi();
    for (let i = 0; i < 5; i++) {
      await fetchMyAchievements();
    }
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("refetches when force is true even with a warm cache", async () => {
    const { fetchMyAchievements } = await loadAchievementsApi();
    await fetchMyAchievements();
    await fetchMyAchievements({ force: true });
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
