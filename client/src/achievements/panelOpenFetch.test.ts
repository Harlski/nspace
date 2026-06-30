import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ACH_PAYLOAD = {
  totalPoints: 42,
  telescopeUnlocked: false,
  achievements: [],
};

describe("achievement panel open fetch behavior", () => {
  let parent: HTMLElement;

  beforeEach(() => {
    vi.resetModules();
    parent = document.createElement("div");
    document.body.appendChild(parent);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ACH_PAYLOAD,
      }))
    );
    vi.doMock("../auth/session.js", () => ({
      loadCachedSession: () => ({ token: "test-token" }),
    }));
    vi.doMock("../net/apiBase.js", () => ({
      apiUrl: (path: string) => path,
    }));
  });

  afterEach(() => {
    parent.remove();
    vi.unstubAllGlobals();
  });

  async function createPanel() {
    const { createAchievementPanel } = await import("./panel.js");
    return createAchievementPanel(parent);
  }

  it("uses one HTTP request when reopening within the session cache window", async () => {
    const panel = await createPanel();
    panel.open();
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));

    panel.close();
    panel.open();
    panel.open();

    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
  });

  it("coalesces overlapping opens while the first fetch is in flight", async () => {
    let resolveFetch!: (value: typeof ACH_PAYLOAD) => void;
    const pending = new Promise<typeof ACH_PAYLOAD>((resolve) => {
      resolveFetch = resolve;
    });
    vi.mocked(fetch).mockImplementationOnce(
      () =>
        ({
          ok: true,
          json: () => pending,
        }) as Response
    );

    const panel = await createPanel();
    panel.open();
    panel.close();
    panel.open();

    resolveFetch(ACH_PAYLOAD);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
  });
});
