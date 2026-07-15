import { describe, it, expect } from "vitest";

import {
  floorWalkableTerrain,
  floorWalkableTerrainForMover,
  isUnlockPadPassableForMover,
  type TerrainProps,
} from "./grid.js";
import { HUB_ROOM_ID } from "./roomLayouts.js";

const PAD_ID = "pad-1";

function padProps(): TerrainProps {
  return {
    passable: false,
    half: false,
    quarter: false,
    hex: false,
    pyramid: false,
    sphere: false,
    ramp: false,
    rampDir: 0,
    colorRgb: 0x22c55e,
    unlockPad: {
      amountLuna: "1000",
      recipient: "SYSTEM",
      buttonLabel: "Unlock",
      proofMode: "optimistic",
      instanceId: PAD_ID,
    },
  };
}

describe("Unlock Pad walk grants", () => {
  it("allows mover pathfinding onto a granted Unlock Pad", () => {
    const placed = new Map<string, TerrainProps>([["0,0", padProps()]]);
    const extra = new Set<string>();
    const unlocked = new Set<string>([PAD_ID]);

    expect(
      floorWalkableTerrain(0, 0, placed, extra, HUB_ROOM_ID, null, null)
    ).toBe(false);
    expect(isUnlockPadPassableForMover(padProps(), unlocked)).toBe(true);
    expect(
      floorWalkableTerrainForMover(
        0,
        0,
        placed,
        extra,
        HUB_ROOM_ID,
        null,
        "NQTEST",
        Date.now(),
        unlocked,
        null
      )
    ).toBe(true);
  });
});
