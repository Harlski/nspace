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

  it("clears frozen when the delta omits the flag (Unfreeze)", () => {
    const prev = {
      address: "NQPLAYER",
      displayName: "Bob",
      x: 1,
      y: 0,
      z: 2,
      vx: 0,
      vz: 0,
      frozen: true,
    };
    const delta = {
      address: "NQPLAYER",
      displayName: "Bob",
      x: 1,
      y: 0,
      z: 2,
      vx: 0,
      vz: 0,
    };
    expect(mergeStateDeltaPlayer(prev, delta).frozen).toBeUndefined();
  });

  it("keeps previous pose when a presence delta omits x/y/z/vx/vz", () => {
    const prev = {
      address: "NQWALKER",
      displayName: "Ada",
      x: 12.5,
      y: 1,
      z: 4,
      vx: 5,
      vz: 0,
      chatTyping: false as boolean | undefined,
    };
    const delta = {
      address: "NQWALKER",
      displayName: "Ada",
      chatTyping: true,
    };
    const merged = mergeStateDeltaPlayer(prev, delta);
    expect(merged.x).toBe(12.5);
    expect(merged.y).toBe(1);
    expect(merged.z).toBe(4);
    expect(merged.vx).toBe(5);
    expect(merged.vz).toBe(0);
    expect(merged.chatTyping).toBe(true);
  });
});
