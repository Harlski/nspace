import { describe, expect, it } from "vitest";

import {
  leadingCountryChip,
  rankCountryGoals,
  usesScoreboardChip,
} from "./scoreboardView.js";

describe("usesScoreboardChip", () => {
  it("uses the chip on a narrow viewport", () => {
    expect(
      usesScoreboardChip({ viewportWidth: 720, coarsePointer: false })
    ).toBe(true);
    expect(
      usesScoreboardChip({ viewportWidth: 721, coarsePointer: false })
    ).toBe(false);
  });

  it("uses the chip on a coarse pointer even when the viewport is wide", () => {
    expect(
      usesScoreboardChip({ viewportWidth: 1280, coarsePointer: true })
    ).toBe(true);
  });
});

describe("rankCountryGoals", () => {
  it("orders by goals descending and caps at eight", () => {
    const ranked = rankCountryGoals([
      { code: "DE", goals: 2 },
      { code: "BR", goals: 9 },
      { code: "JP", goals: 4 },
      { code: "FR", goals: 1 },
      { code: "NG", goals: 3 },
      { code: "AR", goals: 5 },
      { code: "IT", goals: 6 },
      { code: "ES", goals: 7 },
      { code: "GB", goals: 8 },
    ]);
    expect(ranked.map((row) => row.code)).toEqual([
      "BR",
      "GB",
      "ES",
      "IT",
      "AR",
      "JP",
      "NG",
      "DE",
    ]);
    expect(ranked[0]).toEqual({ rank: 1, code: "BR", goals: 9 });
    expect(ranked).toHaveLength(8);
  });
});

describe("leadingCountryChip", () => {
  it("returns the first ranked country as rank 1", () => {
    expect(
      leadingCountryChip([
        { code: "JP", goals: 2 },
        { code: "BR", goals: 5 },
      ])
    ).toEqual({ rank: 1, code: "BR", goals: 5 });
  });

  it("is empty when nobody has scored", () => {
    expect(leadingCountryChip([])).toBeNull();
  });
});
