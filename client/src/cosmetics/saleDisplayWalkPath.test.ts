import { describe, expect, it } from "vitest";
import { toggleWalkPathTile } from "./saleDisplayWalkPath.js";

describe("toggleWalkPathTile", () => {
  it("appends a new tile", () => {
    expect(toggleWalkPathTile([], 1, 2)).toEqual([{ x: 1, z: 2 }]);
    expect(toggleWalkPathTile([{ x: 1, z: 2 }], 3, 4)).toEqual([
      { x: 1, z: 2 },
      { x: 3, z: 4 },
    ]);
  });

  it("unselects the last tile when clicked again", () => {
    expect(
      toggleWalkPathTile(
        [
          { x: 0, z: 0 },
          { x: 1, z: 0 },
        ],
        1,
        0
      )
    ).toEqual([{ x: 0, z: 0 }]);
  });

  it("truncates from an earlier waypoint when that tile is clicked", () => {
    expect(
      toggleWalkPathTile(
        [
          { x: 0, z: 0 },
          { x: 1, z: 0 },
          { x: 2, z: 0 },
        ],
        1,
        0
      )
    ).toEqual([{ x: 0, z: 0 }]);
  });

  it("clears the path when the first tile is clicked", () => {
    expect(
      toggleWalkPathTile(
        [
          { x: 0, z: 0 },
          { x: 1, z: 0 },
        ],
        0,
        0
      )
    ).toEqual([]);
  });
});
