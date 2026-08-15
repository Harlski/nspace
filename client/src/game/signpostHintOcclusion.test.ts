import { describe, expect, it } from "vitest";
import {
  forEachPaddedTileOnSegment,
  forEachTileOnSegment,
} from "./signpostHintOcclusion.js";

function collect(
  fn: (visit: (tx: number, tz: number) => void) => void
): string[] {
  const out: string[] = [];
  fn((tx, tz) => out.push(`${tx},${tz}`));
  return out;
}

describe("signpostHintOcclusion tile segment", () => {
  it("visits only the start tile for a zero-length segment", () => {
    expect(
      collect((v) => forEachTileOnSegment(1.2, 3.8, 1.9, 3.1, v))
    ).toEqual(["1,3"]);
  });

  it("covers an axis-aligned run of tiles", () => {
    expect(
      collect((v) => forEachTileOnSegment(0.1, 0.1, 3.9, 0.2, v))
    ).toEqual(["0,0", "1,0", "2,0", "3,0"]);
  });

  it("covers a diagonal without skipping corners", () => {
    const tiles = collect((v) => forEachTileOnSegment(0.1, 0.1, 2.9, 2.9, v));
    expect(tiles[0]).toBe("0,0");
    expect(tiles[tiles.length - 1]).toBe("2,2");
    expect(tiles).toContain("1,1");
  });

  it("pad expands Chebyshev neighborhood and stays bounded", () => {
    const tiles = collect((v) =>
      forEachPaddedTileOnSegment(0.5, 0.5, 2.5, 0.5, 1, v)
    );
    // Core line tiles 0,0 → 2,0 with pad 1 ⇒ x∈[-1,3], z∈[-1,1] = 15 tiles.
    expect(tiles).toHaveLength(15);
    expect(tiles).toContain("1,1");
    expect(tiles).toContain("1,-1");
    expect(tiles).not.toContain("5,0");
  });
});
