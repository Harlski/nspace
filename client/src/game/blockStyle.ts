/** Preset colors for blocks; index is stored on the server as `colorId`. */
export const BLOCK_COLOR_PALETTE: readonly number[] = [
  0x5b6b8c,
  0xc94c4c,
  0x4caf50,
  0x2196f3,
  0xffc107,
  0x9c27b0,
  0x795548,
  0x00bcd4,
  /** True orange (Material palette); good default for accent hex slabs. */
  0xff9800,
  /** Gold (#E9B213). */
  0xe9b213,
];

export const BLOCK_COLOR_COUNT = BLOCK_COLOR_PALETTE.length;

/** Palette index for the Material orange swatch (`0xff9800`). */
export const BLOCK_COLOR_ORANGE_ID = 8;

/** Palette index for gold `#E9B213`. */
export const BLOCK_COLOR_GOLD_ID = 9;

export function blockColorHex(colorId: number): number {
  const id = Math.max(
    0,
    Math.min(BLOCK_COLOR_PALETTE.length - 1, Math.floor(colorId))
  );
  return BLOCK_COLOR_PALETTE[id]!;
}

/** HSL with `h`,`s`,`l` in 0–1; returns sRGB 0–255 per channel. */
export function hslToRgb(
  h: number,
  s: number,
  l: number
): { r: number; g: number; b: number } {
  if (s <= 0) {
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v };
  }
  const hue2rgb = (p: number, q: number, t: number): number => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const r = hue2rgb(p, q, h + 1 / 3);
  const g = hue2rgb(p, q, h);
  const b = hue2rgb(p, q, h - 1 / 3);
  return {
    r: Math.round(Math.min(255, Math.max(0, r * 255))),
    g: Math.round(Math.min(255, Math.max(0, g * 255))),
    b: Math.round(Math.min(255, Math.max(0, b * 255))),
  };
}

/** Map an arbitrary RGB to the closest preset `colorId` (server stores indices only). */
export function nearestPaletteColorIdFromRgb(
  r: number,
  g: number,
  b: number
): number {
  let bestI = 0;
  let bestD = Infinity;
  for (let i = 0; i < BLOCK_COLOR_PALETTE.length; i++) {
    const c = BLOCK_COLOR_PALETTE[i]!;
    const pr = (c >> 16) & 0xff;
    const pg = (c >> 8) & 0xff;
    const pb = c & 0xff;
    const d =
      (r - pr) * (r - pr) +
      (g - pg) * (g - pg) +
      (b - pb) * (b - pb);
    if (d < bestD) {
      bestD = d;
      bestI = i;
    }
  }
  return bestI;
}

export type BlockStyleProps = {
  passable: boolean;
  /** Slab height (ignored if `quarter` is true). */
  half: boolean;
  /** Low slab — supersedes `half` when true. */
  quarter: boolean;
  /** Hexagonal prism (flat-top), same footprint as a tile. */
  hex: boolean;
  /** Walkable ramp; use `rampDir` 0–3 = +X,+Z,−X,−Z toward solid block climbed. */
  ramp: boolean;
  rampDir: number;
  colorId: number;
  /** Whether this object is locked (admin-only editing). */
  locked?: boolean;
  // Experimental: Claimable/minable blocks
  claimable?: boolean;
  active?: boolean;
  cooldownMs?: number;
  lastClaimedAt?: number;
  claimedBy?: string;
};
