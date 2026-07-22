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
