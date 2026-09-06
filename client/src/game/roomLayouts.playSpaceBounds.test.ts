import { describe, expect, it } from "vitest";
import {
  getRoomBaseBounds,
  registerClientRoomBounds,
} from "./roomLayouts.js";
import { PLAY_SPACE_BOUNDS } from "../invite/playSpaceLayout.js";

describe("getRoomBaseBounds for Play Spaces", () => {
  it("falls back to PLAY_SPACE_BOUNDS when no welcome bounds are registered", () => {
    const id = "invite-lobby-TEST01";
    expect(getRoomBaseBounds(id)).toEqual({ ...PLAY_SPACE_BOUNDS });
  });

  it("uses registered welcome bounds so template floors outside the default rect stay on-map", () => {
    const id = "invite-lobby-WIDE01";
    const templateBounds = {
      minX: -8,
      maxX: 7,
      minZ: -8,
      maxZ: 7,
    };
    registerClientRoomBounds(id, templateBounds);
    expect(getRoomBaseBounds(id)).toEqual(templateBounds);
  });
});

describe("getRoomBaseBounds for wallet rooms", () => {
  it("falls back to Hub bounds when no welcome bounds are registered", () => {
    const id = "walletroom30";
    expect(getRoomBaseBounds(id)).toEqual({
      minX: -12,
      maxX: 12,
      minZ: -12,
      maxZ: 12,
    });
  });

  it("uses registered welcome bounds so 30x30 edge tiles stay on-map", () => {
    const id = "walletroom30b";
    const bounds = { minX: -15, maxX: 14, minZ: -15, maxZ: 14 };
    registerClientRoomBounds(id, bounds);
    expect(getRoomBaseBounds(id)).toEqual(bounds);
  });
});

