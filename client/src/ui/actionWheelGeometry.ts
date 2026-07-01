/**
 * Pure geometry + paging helpers for the Action Wheel (the hexagonal self-menu).
 *
 * No DOM here - just the math the HUD component needs, so it can be unit tested in
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

type Pt = { x: number; y: number };

/**
 * Closed SVG path through `points` with each corner softened by a quadratic-bezier
 * fillet. `cornerRadius` is either one radius for every corner or a per-corner array
 * (index-aligned to `points`); a corner with radius `<= 0` stays a sharp vertex. When
 * every corner is sharp it degenerates to a straight `M … L … Z` polygon - byte-for-byte
 * the old output, so callers that pass no radius are unchanged.
 *
 * Because each fillet truncates its two edges symmetrically and curves through the
 * original vertex, two shapes that share an edge (adjacent Sectors share a radial edge)
 * round that shared corner identically - the rounded frame tiles seamlessly with no gaps.
 */
function roundedPolyPath(points: Pt[], cornerRadius: number | number[]): string {
  const n = points.length;
  if (n < 3) return "";
  const radii =
    typeof cornerRadius === "number"
      ? points.map(() => cornerRadius)
      : points.map((_, i) => cornerRadius[i] ?? 0);
  if (radii.every((r) => r <= 0)) {
    return `M ${points.map((p) => `${f(p.x)} ${f(p.y)}`).join(" L ")} Z`;
  }
  const cmds: string[] = [];
  let started = false;
  for (let i = 0; i < n; i++) {
    const prev = points[(i - 1 + n) % n]!;
    const curr = points[i]!;
    const next = points[(i + 1) % n]!;
    const want = radii[i] ?? 0;
    if (want <= 0) {
      cmds.push(`${started ? "L" : "M"} ${f(curr.x)} ${f(curr.y)}`);
      started = true;
      continue;
    }
    const dPrev = Math.hypot(prev.x - curr.x, prev.y - curr.y);
    const dNext = Math.hypot(next.x - curr.x, next.y - curr.y);
    const r = Math.min(want, dPrev / 2, dNext / 2);
    const start = {
      x: curr.x + ((prev.x - curr.x) / dPrev) * r,
      y: curr.y + ((prev.y - curr.y) / dPrev) * r,
    };
    const end = {
      x: curr.x + ((next.x - curr.x) / dNext) * r,
      y: curr.y + ((next.y - curr.y) / dNext) * r,
    };
    cmds.push(
      `${started ? "L" : "M"} ${f(start.x)} ${f(start.y)}`,
      `Q ${f(curr.x)} ${f(curr.y)} ${f(end.x)} ${f(end.y)}`
    );
    started = true;
  }
  cmds.push("Z");
  return cmds.join(" ");
}

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
 * straight chords - tiling six of them yields a crisp hexagonal frame, not a circle.
 *
 * Pass `cornerRadius > 0` to soften the two outer corners with seamless quadratic
 * fillets; `innerCornerRadius` (defaults to `cornerRadius`) controls the two inner
 * corners separately so the inner ring can curve less than the outer. The default 0
 * keeps the original sharp trapezoid.
 */
export function hexSegmentPath(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  midDeg: number,
  cornerRadius = 0,
  innerCornerRadius = cornerRadius
): string {
  const a = midDeg - 30;
  const b = midDeg + 30;
  return roundedPolyPath(
    [
      polarToXy(cx, cy, rOuter, a),
      polarToXy(cx, cy, rOuter, b),
      polarToXy(cx, cy, rInner, b),
      polarToXy(cx, cy, rInner, a),
    ],
    // Points are ordered outer-a, outer-b, inner-b, inner-a.
    [cornerRadius, cornerRadius, innerCornerRadius, innerCornerRadius]
  );
}

/**
 * Closed SVG path for a regular hexagon outline of circumradius `r`, oriented to match
 * the Sectors (vertices at 0°, 60°, …, 300°; flat top & bottom edges). Used for the rim
 * around the Hub. Pass `cornerRadius > 0` to round the six corners to match the Sectors.
 */
export function hexPolygonPath(
  cx: number,
  cy: number,
  r: number,
  cornerRadius = 0
): string {
  const pts: Pt[] = [];
  for (let i = 0; i < 6; i++) {
    pts.push(polarToXy(cx, cy, r, i * 60));
  }
  return roundedPolyPath(pts, cornerRadius);
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
