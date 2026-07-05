import { describe, expect, it } from "vitest";

import { applyRemoteMoveAbort, type RemoteMoveAbortWire } from "./moveAbortPlayback.js";

describe("applyRemoteMoveAbort", () => {
  it("clears stored path playback and snaps pose", () => {
    const orders = new Map<string, { path: unknown[] }>();
    orders.set("NQ97 TEST", { path: [{ x: 1, z: 2, layer: 0 }] });
    const target = { x: 0, y: 0, z: 0, set(x: number, y: number, z: number) {
      this.x = x;
      this.y = y;
      this.z = z;
    } };
    const avatar = { position: { x: 0, y: 0, z: 0, set(x: number, y: number, z: number) {
      this.x = x;
      this.y = y;
      this.z = z;
    } } };

    const msg: RemoteMoveAbortWire = {
      address: "NQ97 TEST",
      x: 5,
      z: 4,
      y: 1,
      vx: 0,
      vz: 0,
    };
    applyRemoteMoveAbort({
      msg,
      selfAddress: "NQ98 SELF",
      remoteMoveOrders: orders,
      targetPos: target,
      avatarGroup: avatar,
    });

    expect(orders.has("NQ97 TEST")).toBe(false);
    expect(target.x).toBe(5);
    expect(target.y).toBe(1);
    expect(target.z).toBe(4);
    expect(avatar.position.x).toBe(5);
    expect(avatar.position.y).toBe(1);
    expect(avatar.position.z).toBe(4);
  });

  it("ignores abort for the local player", () => {
    const orders = new Map<string, { path: unknown[] }>();
    orders.set("NQ97 SELF", { path: [{ x: 1, z: 2, layer: 0 }] });
    const target = { x: 0, y: 0, z: 0, set() {} };
    const avatar = { position: { x: 0, y: 0, z: 0, set() {} } };

    applyRemoteMoveAbort({
      msg: {
        address: "NQ97 SELF",
        x: 5,
        z: 4,
        y: 0,
        vx: 0,
        vz: 0,
      },
      selfAddress: "NQ97 SELF",
      remoteMoveOrders: orders,
      targetPos: target,
      avatarGroup: avatar,
    });

    expect(orders.has("NQ97 SELF")).toBe(true);
  });
});
