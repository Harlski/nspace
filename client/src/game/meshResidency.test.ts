import { describe, expect, it } from "vitest";
import {
  nextResidentChunks,
  MESH_RESIDENCY_UNLOAD_PADDING_CHUNKS,
} from "./meshResidency.js";
import { interestChunksFromRect, type ViewInterestRect } from "./interestChunks.js";

describe("nextResidentChunks", () => {
  const rect: ViewInterestRect = {
    centerX: 0,
    centerZ: 0,
    halfW: 8,
    halfH: 8,
  };

  it("loads chunks that intersect the residency rect when previous is empty", () => {
    const load = interestChunksFromRect(rect, 0);
    const next = nextResidentChunks(new Set(), rect);
    expect([...next].sort()).toEqual([...load].sort());
    expect(next.size).toBeGreaterThan(0);
  });

  it("keeps previous chunks inside the unload ring when the load ring shrinks away", () => {
    const wide: ViewInterestRect = {
      centerX: 0,
      centerZ: 0,
      halfW: 40,
      halfH: 40,
    };
    const afterWide = nextResidentChunks(new Set(), wide);
    expect(afterWide.size).toBeGreaterThan(1);

    const narrow: ViewInterestRect = {
      centerX: 0,
      centerZ: 0,
      halfW: 4,
      halfH: 4,
    };
    const keep = interestChunksFromRect(narrow, MESH_RESIDENCY_UNLOAD_PADDING_CHUNKS);
    const load = interestChunksFromRect(narrow, 0);
    const next = nextResidentChunks(afterWide, narrow);

    for (const c of load) {
      expect(next.has(c)).toBe(true);
    }
    for (const c of next) {
      expect(keep.has(c)).toBe(true);
    }
    // Hysteresis: some chunks from the wide set can remain if still in keep.
    expect(next.size).toBeGreaterThanOrEqual(load.size);
  });

  it("drops chunks outside the unload ring", () => {
    const previous = new Set(["0,0", "50,50", "-50,-50"]);
    const next = nextResidentChunks(previous, rect);
    expect(next.has("0,0")).toBe(true);
    expect(next.has("50,50")).toBe(false);
    expect(next.has("-50,-50")).toBe(false);
  });
});
