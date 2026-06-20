/**
 * Pure geometry + paging helpers for the Action Wheel (the hexagonal self-menu).
 *
 * No DOM here — just the math the HUD component needs, so it can be unit tested in
 * isolation. Angles are in degrees on the SVG convention: 0° = +x (right), increasing
 * clockwise, so 90° = bottom (where the Nav Sector lives), 270° = top. The wheel is a
 * flat-top hexagon (flat top & bottom edges, points to the left/right): its six edges
 * are centred at 30°, 90°, …, 330°, so each of the six equal Sectors owns one edge.
 */

export type Sector = {
  /** Slice index. 0 is always the Nav Sector, centered at the bottom. */
  index: number;
  startDeg: number;
  endDeg: number;
  /** Angle of the slice's centre, where its icon/label is placed. */
  midDeg: number;
};

/** Bottom of the wheel in SVG angle convention (y grows downward). */
export const BOTTOM_DEG = 90;

/**
 * Split the ring into `count` equal slices with slice 0 centred at the bottom
 * (the Nav Sector). Remaining slices follow clockwise. `count` includes the Nav Sector,
 * so two live Sectors → `count = 3`.
 */
export function equalSectors(count: number): Sector[] {
  if (!Number.isFinite(count) || count < 1) return [];
  const n = Math.floor(count);
  const sweep = 360 / n;
  const sectors: Sector[] = [];
  for (let i = 0; i < n; i++) {
    const midDeg = BOTTOM_DEG + i * sweep;
    sectors.push({
      index: i,
      startDeg: midDeg - sweep / 2,
      endDeg: midDeg + sweep / 2,
      midDeg,
    });
  }
  return sectors;
}

/** Point on a circle of radius `r` centred at (cx, cy) at angle `deg`. */
export function polarToXy(
  cx: number,
  cy: number,
  r: number,
  deg: number
): { x: number; y: number } {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

const f = (n: number): string => Number(n.toFixed(3)).toString();

/**
 * Distance from the centre to an edge midpoint (the apothem) of a regular hexagon
 * with circumradius `r`. Useful for placing glyphs in the middle of a segment.
 */
export function hexApothem(r: number): number {
  return r * Math.cos(Math.PI / 6);
}

/**
 * SVG path for one trapezoidal hexagon Sector centred at `midDeg`, between the inner
 * and outer hexagon rings (circumradii `rInner`/`rOuter`). A Sector spans exactly one
 * hexagon edge (±30° from its centre), so both its outer and inner boundaries are
 * straight chords — tiling six of them yields a crisp hexagonal frame, not a circle.
 */
export function hexSegmentPath(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  midDeg: number
): string {
  const a = midDeg - 30;
  const b = midDeg + 30;
  const o1 = polarToXy(cx, cy, rOuter, a);
  const o2 = polarToXy(cx, cy, rOuter, b);
  const i2 = polarToXy(cx, cy, rInner, b);
  const i1 = polarToXy(cx, cy, rInner, a);
  return [
    `M ${f(o1.x)} ${f(o1.y)}`,
    `L ${f(o2.x)} ${f(o2.y)}`,
    `L ${f(i2.x)} ${f(i2.y)}`,
    `L ${f(i1.x)} ${f(i1.y)}`,
    "Z",
  ].join(" ");
}

/**
 * Closed SVG path for a regular hexagon outline of circumradius `r`, oriented to match
 * the Sectors (vertices at 0°, 60°, …, 300°; flat top & bottom edges). Used for the rim
 * around the Hub.
 */
export function hexPolygonPath(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const p = polarToXy(cx, cy, r, i * 60);
    pts.push(`${f(p.x)} ${f(p.y)}`);
  }
  return `M ${pts.join(" L ")} Z`;
}

/** Number of pages needed to show `total` emotes at `perPage` each (min 1). */
export function emotePageCount(total: number, perPage: number): number {
  if (perPage < 1) return 1;
  return Math.max(1, Math.ceil(total / perPage));
}

/** The emotes shown on `page` (0-based), wrapping is the caller's concern. */
export function emotePageSlice<T>(items: T[], page: number, perPage: number): T[] {
  if (perPage < 1) return [];
  const start = page * perPage;
  return items.slice(start, start + perPage);
}

/** Next page index, wrapping back to 0 after the last page. */
export function nextPage(page: number, pageCount: number): number {
  if (pageCount < 1) return 0;
  return (page + 1) % pageCount;
}
