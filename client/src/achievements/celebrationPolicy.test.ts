import { describe, expect, it } from "vitest";
import {
  celebrationOpacity,
  celebrationPopScale,
  celebrationSpringYOffset,
} from "./celebrationPolicy.js";
import {
  clearCelebrationSchedule,
  nextCelebrationDelayMs,
} from "./celebrationStagger.js";

describe("celebrationSpringYOffset", () => {
  it("starts at zero and rises during the pop", () => {
    expect(celebrationSpringYOffset(0)).toBe(0);
    expect(celebrationSpringYOffset(0.1)).toBeGreaterThan(0);
  });

  it("hovers during the hold phase", () => {
    const mid = celebrationSpringYOffset(0.4);
    const later = celebrationSpringYOffset(0.55);
    expect(mid).not.toBeCloseTo(later, 5);
  });
});

describe("celebrationPopScale", () => {
  it("starts at zero scale and settles to one", () => {
    expect(celebrationPopScale(0)).toBeCloseTo(0);
    expect(celebrationPopScale(1)).toBe(1);
    expect(celebrationPopScale(0.5)).toBeGreaterThan(1);
  });
});

describe("celebrationOpacity", () => {
  it("holds full opacity then fades near the end", () => {
    expect(celebrationOpacity(0.5)).toBe(1);
    expect(celebrationOpacity(0.84)).toBe(1);
    expect(celebrationOpacity(0.92)).toBeLessThan(1);
    expect(celebrationOpacity(1)).toBe(0);
  });
});

describe("celebration stagger", () => {
  it("returns zero delay for the first pop then staggers", () => {
    const schedule = new Map<string, number>();
    expect(nextCelebrationDelayMs(schedule, "addr1", 1000)).toBe(0);
    expect(nextCelebrationDelayMs(schedule, "addr1", 1000)).toBe(1200);
    expect(nextCelebrationDelayMs(schedule, "addr2", 1000)).toBe(0);
    clearCelebrationSchedule(schedule, "addr1");
    expect(schedule.has("addr1")).toBe(false);
  });
});
