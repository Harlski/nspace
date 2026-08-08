import { describe, expect, it } from "vitest";
import { mergeStateDeltaPlayer } from "./mergeStateDeltaPlayer.js";

describe("mergeStateDeltaPlayer", () => {
  it("clears adminInvisible when the delta omits the flag (toggle OFF)", () => {
    const prev = {
      address: "NQADMIN",
      displayName: "Ops",
      x: 0,
      y: 0,
      z: 0,
      vx: 0,
      vz: 0,
      adminInvisible: true,
    };
    const delta = {
      address: "NQADMIN",
      displayName: "Ops",
      x: 0,
      y: 0,
      z: 0,
      vx: 0,
      vz: 0,
      // adminInvisible omitted when false on the wire
    };
    const merged = mergeStateDeltaPlayer(prev, delta);
    expect(merged.adminInvisible).toBeUndefined();
    expect(Boolean(merged.adminInvisible)).toBe(false);
  });

  it("adopts adminInvisible when the delta sets it (toggle ON)", () => {
    const prev = {
      address: "NQADMIN",
      displayName: "Ops",
      x: 0,
      y: 0,
      z: 0,
      vx: 0,
      vz: 0,
    };
    const delta = {
      ...prev,
      adminInvisible: true,
    };
    expect(mergeStateDeltaPlayer(prev, delta).adminInvisible).toBe(true);
  });
});
