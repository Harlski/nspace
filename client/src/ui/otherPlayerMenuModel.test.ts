import { describe, it, expect } from "vitest";
import { buildOtherPlayerMenuModel } from "./otherPlayerMenuModel.js";

describe("buildOtherPlayerMenuModel", () => {
  it("root shows View {username} and Accept 1v1 only when Challenge is open", () => {
    const closed = buildOtherPlayerMenuModel({
      username: "Ada",
      challengeOpen: false,
      viewerIsGameAdmin: false,
      targetIsGameAdmin: false,
      targetFrozen: false,
    });
    expect(closed.panels.root.rows.map((r) => r.id)).toEqual(["view"]);
    expect(closed.panels.root.rows[0]!.label).toBe("View Ada");

    const open = buildOtherPlayerMenuModel({
      username: "Ada",
      challengeOpen: true,
      viewerIsGameAdmin: false,
      targetIsGameAdmin: false,
      targetFrozen: false,
    });
    expect(open.panels.root.rows.map((r) => r.id)).toEqual([
      "view",
      "accept1v1",
    ]);
  });

  it("actions panel has View Profile and Whisper; never Copy Wallet; More only when children exist", () => {
    const nonAdmin = buildOtherPlayerMenuModel({
      username: "Ada",
      challengeOpen: false,
      viewerIsGameAdmin: false,
      targetIsGameAdmin: false,
      targetFrozen: false,
    });
    expect(nonAdmin.panels.actions?.rows.map((r) => r.id)).toEqual([
      "viewProfile",
      "whisper",
    ]);
    expect(nonAdmin.panels.more).toBeUndefined();
    expect(
      Object.values(nonAdmin.panels)
        .flatMap((p) => p?.rows ?? [])
        .some((r) => /copy wallet/i.test(r.label))
    ).toBe(false);
  });

  it("admin viewer gets More → Administrative → Freeze/Unfreeze; admin targets disable Freeze", () => {
    const adminVsPlayer = buildOtherPlayerMenuModel({
      username: "Bob",
      challengeOpen: false,
      viewerIsGameAdmin: true,
      targetIsGameAdmin: false,
      targetFrozen: false,
    });
    expect(adminVsPlayer.panels.actions?.rows.map((r) => r.id)).toEqual([
      "viewProfile",
      "whisper",
      "more",
    ]);
    expect(adminVsPlayer.panels.more?.rows.map((r) => r.id)).toEqual([
      "administrative",
    ]);
    const freeze = adminVsPlayer.panels.administrative?.rows[0];
    expect(freeze).toMatchObject({
      id: "freeze",
      label: "Freeze Player",
      disabled: false,
    });

    const frozen = buildOtherPlayerMenuModel({
      username: "Bob",
      challengeOpen: false,
      viewerIsGameAdmin: true,
      targetIsGameAdmin: false,
      targetFrozen: true,
    });
    expect(frozen.panels.administrative?.rows[0]?.label).toBe(
      "Unfreeze Player"
    );

    const adminVsAdmin = buildOtherPlayerMenuModel({
      username: "Ops",
      challengeOpen: false,
      viewerIsGameAdmin: true,
      targetIsGameAdmin: true,
      targetFrozen: false,
    });
    expect(adminVsAdmin.panels.administrative?.rows[0]).toMatchObject({
      id: "freeze",
      disabled: true,
    });
  });
});
