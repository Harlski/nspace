import { describe, expect, it } from "vitest";
import { buildPlaySpaceXShareUrl } from "./shareUrl.js";

describe("buildPlaySpaceXShareUrl", () => {
  it("builds an X compose intent with share text and join link", () => {
    const url = buildPlaySpaceXShareUrl("https://space.nimiq.com/join/AB12CD");
    expect(url).toMatch(/^https:\/\/x\.com\/intent\/tweet\?/);
    const params = new URL(url).searchParams;
    expect(params.get("text")).toBe("Join my private play space on Nimiq Space!");
    expect(params.get("url")).toBe("https://space.nimiq.com/join/AB12CD");
  });

  it("trims whitespace from the join link", () => {
    const url = buildPlaySpaceXShareUrl("  https://space.nimiq.com/join/X  ");
    expect(new URL(url).searchParams.get("url")).toBe("https://space.nimiq.com/join/X");
  });

  it("falls back to bare intent when the join link is empty", () => {
    expect(buildPlaySpaceXShareUrl("   ")).toBe("https://x.com/intent/tweet");
  });
});
