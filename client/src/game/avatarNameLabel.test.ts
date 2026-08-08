import { describe, expect, it } from "vitest";

import { formatAvatarNameLabel } from "./avatarNameLabel";

describe("formatAvatarNameLabel", () => {
  it("includes Player Level for wallets", () => {
    expect(
      formatAvatarNameLabel({ displayName: "Ada", playerLevel: 3 })
    ).toBe("Ada · Lv 3");
  });

  it("omits Level for guests", () => {
    expect(formatAvatarNameLabel({ displayName: "Guest Fox" })).toBe(
      "Guest Fox"
    );
  });

  it("composes Invisible after Level", () => {
    expect(
      formatAvatarNameLabel({
        displayName: "Ada",
        playerLevel: 1,
        adminInvisible: true,
      })
    ).toBe("Ada · Lv 1 · Invisible");
  });
});
