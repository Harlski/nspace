import { describe, expect, it } from "vitest";
import {
  AMBIENT_CAST_VISIBLE_CAP,
  selectSoftDensityTokens,
} from "./softDensity.js";

describe("selectSoftDensityTokens", () => {
  it("returns empty for empty input", () => {
    expect(selectSoftDensityTokens([])).toEqual([]);
  });

  it("returns all tokens when under the visible cap", () => {
    const tokens = ["a", "b", "c"];
    expect(selectSoftDensityTokens(tokens, { visibleCap: 12 })).toEqual(tokens);
  });

  it("caps and cycles through a larger unique set", () => {
    const tokens = Array.from({ length: 20 }, (_, i) => `t${i}`);
    const a = selectSoftDensityTokens(tokens, {
      visibleCap: 8,
      cycleIndex: 0,
    });
    const b = selectSoftDensityTokens(tokens, {
      visibleCap: 8,
      cycleIndex: 1,
    });
    expect(a).toHaveLength(8);
    expect(b).toHaveLength(8);
    expect(a[0]).toBe("t0");
    expect(b[0]).toBe("t8");
    expect(a).not.toEqual(b);
  });

  it("defaults to the Ambient Cast visible cap", () => {
    expect(AMBIENT_CAST_VISIBLE_CAP).toBe(12);
    const tokens = Array.from({ length: 30 }, (_, i) => `t${i}`);
    expect(selectSoftDensityTokens(tokens)).toHaveLength(12);
  });
});
