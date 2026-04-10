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
};
