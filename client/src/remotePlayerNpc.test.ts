import { describe, expect, it } from "vitest";
import { remotePlayerIsNpc } from "./remotePlayerNpc.js";

describe("remotePlayerIsNpc", () => {
  it("detects server fake address marker", () => {
    expect(
      remotePlayerIsNpc("NQ07ROOMIDX00FAKENPC000000000000", "Marie")
    ).toBe(true);
  });

  it("detects NPC display prefix", () => {
    expect(remotePlayerIsNpc("NQ00 HUMAN 0000", "[NPC] Marie")).toBe(true);
  });

  it("returns false for normal-looking player", () => {
    expect(
      remotePlayerIsNpc(
        "NQ97 4M1T 4TGD VC7F LHLQ Y2DY 425N 5CVH M02Y",
        "Alice"
      )
    ).toBe(false);
  });
});
