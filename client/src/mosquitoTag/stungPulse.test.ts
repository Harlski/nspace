import { describe, expect, it } from "vitest";
import { stungPulseActive } from "./stungPulse.js";

describe("stungPulseActive", () => {
  it("is on for the Stung player until remaining ms elapse", () => {
    const snap = { stungPlayerId: "AA", stungRemainingMs: 30_000 };
    expect(stungPulseActive(snap, "AA", 0)).toBe(true);
    expect(stungPulseActive(snap, "aa", 29_999)).toBe(true);
    expect(stungPulseActive(snap, "AA", 30_000)).toBe(false);
    expect(stungPulseActive(snap, "BB", 0)).toBe(false);
  });

  it("is off when the snapshot has no Stung player", () => {
    expect(stungPulseActive({ stungPlayerId: null, stungRemainingMs: 30_000 }, "AA", 0)).toBe(
      false
    );
    expect(stungPulseActive(null, "AA", 0)).toBe(false);
  });
});
