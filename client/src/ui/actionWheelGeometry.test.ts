import { describe, it, expect } from "vitest";
import {
  equalSectors,
  polarToXy,
  hexSegmentPath,
  hexPolygonPath,
  hexApothem,
  emotePageCount,
  emotePageSlice,
  nextPage,
  BOTTOM_DEG,
} from "./actionWheelGeometry.js";

describe("equalSectors", () => {
  it("returns no sectors for invalid counts", () => {
    expect(equalSectors(0)).toEqual([]);
    expect(equalSectors(-3)).toEqual([]);
    expect(equalSectors(Number.NaN)).toEqual([]);
  });

  it("centres slice 0 (the Nav Sector) at the bottom", () => {
    for (const count of [1, 2, 3, 4, 6]) {
      const sectors = equalSectors(count);
      expect(sectors[0]?.midDeg).toBe(BOTTOM_DEG);
    }
  });

  it("splits 360° into equal, contiguous slices", () => {
    const sectors = equalSectors(3);
    expect(sectors).toHaveLength(3);
    const sweep = 360 / 3;
    for (const s of sectors) {
      expect(s.endDeg - s.startDeg).toBeCloseTo(sweep);
    }
    // slice i ends where slice i+1 begins
    expect(sectors[0]!.endDeg).toBeCloseTo(sectors[1]!.startDeg);
    expect(sectors[1]!.endDeg).toBeCloseTo(sectors[2]!.startDeg);
  });

  it("places the two live sectors above the avatar (negative y / upper half)", () => {
    // count = 3 -> nav at bottom, live sectors at indices 1 and 2 up top
    const [, upperLeft, upperRight] = equalSectors(3);
    const l = polarToXy(0, 0, 1, upperLeft!.midDeg);
    const r = polarToXy(0, 0, 1, upperRight!.midDeg);
    expect(l.y).toBeLessThan(0); // above centre
    expect(r.y).toBeLessThan(0);
    expect(l.x).toBeLessThan(0); // left
    expect(r.x).toBeGreaterThan(0); // right
  });
});

describe("polarToXy", () => {
  it("maps cardinal angles correctly (y grows downward)", () => {
    expect(polarToXy(0, 0, 10, 0)).toMatchObject({ x: 10 });
    expect(polarToXy(0, 0, 10, 90).y).toBeCloseTo(10); // bottom
    expect(polarToXy(0, 0, 10, 270).y).toBeCloseTo(-10); // top
  });
});

describe("hexSegmentPath", () => {
  it("is a closed straight-edged trapezoid (4 corners, no arcs)", () => {
    const path = hexSegmentPath(0, 0, 100, 48, 90);
    expect(path.trim().endsWith("Z")).toBe(true);
    expect(path).not.toContain("A"); // straight chords only - no arcs
    // M + three L commands = four corners
    expect((path.match(/L/g) ?? []).length).toBe(3);
  });

  it("gives the bottom Sector a flat horizontal outer edge below centre", () => {
    const path = hexSegmentPath(0, 0, 100, 48, 90);
    const o1 = polarToXy(0, 0, 100, 60);
    const o2 = polarToXy(0, 0, 100, 120);
    expect(o1.y).toBeCloseTo(o2.y); // same height -> horizontal edge
    expect(o1.y).toBeGreaterThan(0); // below centre (y grows downward)
    expect(path.startsWith(`M ${Number(o1.x.toFixed(3))} ${Number(o1.y.toFixed(3))}`)).toBe(true);
  });

  it("softens the four corners with quadratic fillets when given a radius", () => {
    const path = hexSegmentPath(0, 0, 100, 48, 90, 12);
    expect((path.match(/Q/g) ?? []).length).toBe(4); // one fillet per corner
    expect(path).not.toContain("A"); // beziers, not arcs
    expect(path.trim().endsWith("Z")).toBe(true);
  });

  it("rounds outer and inner corners independently", () => {
    // Outer rounded, inner sharp -> only the two outer corners get fillets.
    const path = hexSegmentPath(0, 0, 100, 48, 90, 12, 0);
    expect((path.match(/Q/g) ?? []).length).toBe(2);
    // Both rings rounded but by different radii -> all four corners filleted.
    const both = hexSegmentPath(0, 0, 100, 48, 90, 13, 6);
    expect((both.match(/Q/g) ?? []).length).toBe(4);
  });

  it("rounds a shared radial corner identically for adjacent Sectors (seamless tiling)", () => {
    // Sectors at 90° and 150° share the outer/inner vertices on the 120° radial edge.
    const left = hexSegmentPath(0, 0, 100, 48, 90, 12);
    const right = hexSegmentPath(0, 0, 100, 48, 150, 12);
    // The fillet truncation point on the shared radial edge sits 12px from the shared
    // outer vertex toward the inner vertex; both Sectors must land on the same point.
    const outer = polarToXy(0, 0, 100, 120);
    const inner = polarToXy(0, 0, 48, 120);
    const len = Math.hypot(inner.x - outer.x, inner.y - outer.y);
    const shared = {
      x: outer.x + ((inner.x - outer.x) / len) * 12,
      y: outer.y + ((inner.y - outer.y) / len) * 12,
    };
    const token = `${Number(shared.x.toFixed(3))} ${Number(shared.y.toFixed(3))}`;
    expect(left).toContain(token);
    expect(right).toContain(token);
  });
});

describe("hexPolygonPath", () => {
  it("is a closed six-corner outline", () => {
    const path = hexPolygonPath(0, 0, 48);
    expect((path.match(/L/g) ?? []).length).toBe(5); // M + 5 L = six vertices
    expect(path.trim().endsWith("Z")).toBe(true);
  });

  it("rounds all six corners when given a radius", () => {
    const path = hexPolygonPath(0, 0, 48, 10);
    expect((path.match(/Q/g) ?? []).length).toBe(6);
    expect(path).not.toContain("A");
    expect(path.trim().endsWith("Z")).toBe(true);
  });
});

describe("hexApothem", () => {
  it("returns the edge-midpoint distance (r·cos30°)", () => {
    expect(hexApothem(100)).toBeCloseTo(86.602);
  });
});

describe("emote paging", () => {
  it("computes page counts (min 1)", () => {
    expect(emotePageCount(0, 6)).toBe(1);
    expect(emotePageCount(5, 6)).toBe(1);
    expect(emotePageCount(6, 6)).toBe(1);
    expect(emotePageCount(7, 6)).toBe(2);
    expect(emotePageCount(13, 6)).toBe(3);
  });

  it("slices the items for a given page", () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    expect(emotePageSlice(items, 0, 6)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(emotePageSlice(items, 1, 6)).toEqual([7, 8]);
  });

  it("wraps to the first page after the last", () => {
    expect(nextPage(0, 3)).toBe(1);
    expect(nextPage(2, 3)).toBe(0);
    expect(nextPage(0, 1)).toBe(0);
  });
});
