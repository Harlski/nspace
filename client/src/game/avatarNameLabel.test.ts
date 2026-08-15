import { describe, expect, it } from "vitest";

import {
  formatAvatarNameLabel,
  nameplatePlayerLevel,
} from "./avatarNameLabel";

describe("formatAvatarNameLabel", () => {
  it("is username only (Level badge is drawn separately)", () => {
    expect(formatAvatarNameLabel({ displayName: "Ada" })).toBe("Ada");
  });

  it("composes Invisible after the name", () => {
    expect(
      formatAvatarNameLabel({
        displayName: "Ada",
        adminInvisible: true,
      })
    ).toBe("Ada · Invisible");
  });

  it("composes Frozen for admin viewers", () => {
    expect(
      formatAvatarNameLabel({
        displayName: "Bob",
        frozen: true,
      })
    ).toBe("Bob · Frozen");
  });
});

describe("nameplatePlayerLevel", () => {
  it("keeps valid Levels", () => {
    expect(nameplatePlayerLevel(3)).toBe(3);
  });

  it("rejects guests / missing Level", () => {
    expect(nameplatePlayerLevel(undefined)).toBe(null);
    expect(nameplatePlayerLevel(0)).toBe(null);
  });
});
