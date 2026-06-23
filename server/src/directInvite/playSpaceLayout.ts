import type { RoomBounds } from "../roomLayouts.js";

/** Walkable Play Space footprint (every invite-lobby room shares this template). */
export const PLAY_SPACE_BOUNDS: RoomBounds = {
  minX: -8,
  maxX: 8,
  minZ: -6,
  maxZ: 6,
};

/** Open dance-floor tile at the heart of the chaos. */
export const PLAY_SPACE_SPAWN = { x: 0, z: 0 } as const;

/** One placed block in the shared Play Space template. */
export type PlaySpaceBlockSpec = {
  x: number;
  z: number;
  y?: number;
  passable: boolean;
  half?: boolean;
  quarter?: boolean;
  hex?: boolean;
  sphere?: boolean;
  pyramid?: boolean;
  ramp?: boolean;
  rampDir?: number;
  colorRgb: number;
};

export type PlaySpaceFloorTint = { x: number; z: number; colorRgb: number };

const NEON = {
  pink: 0xff1493,
  gold: 0xffd700,
  cyan: 0x00e5ff,
  violet: 0x9c27b0,
  orange: 0xff5722,
  lime: 0x76ff03,
  indigo: 0x651fff,
  coral: 0xff6b9d,
  aqua: 0x18ffff,
  grape: 0x7c4dff,
} as const;

const WILD_PALETTE = Object.values(NEON);

/** Deterministic “random” palette pick from tile coords. */
function wildColor(x: number, z: number, salt = 0): number {
  const h =
    ((x * 73856093) ^ (z * 19349663) ^ (salt * 83492791)) >>> 0;
  return WILD_PALETTE[h % WILD_PALETTE.length]!;
}

function inBounds(x: number, z: number): boolean {
  return (
    x >= PLAY_SPACE_BOUNDS.minX &&
    x <= PLAY_SPACE_BOUNDS.maxX &&
    z >= PLAY_SPACE_BOUNDS.minZ &&
    z <= PLAY_SPACE_BOUNDS.maxZ
  );
}

function block(spec: PlaySpaceBlockSpec): PlaySpaceBlockSpec {
  return spec;
}

/** Asymmetric sculpture garden — pyramids, orbs, hex totems, ramp bridges. */
function buildWildBlocks(): PlaySpaceBlockSpec[] {
  const out: PlaySpaceBlockSpec[] = [];

  // Corner monoliths
  for (const [x, z, c] of [
    [PLAY_SPACE_BOUNDS.minX, PLAY_SPACE_BOUNDS.minZ, NEON.violet],
    [PLAY_SPACE_BOUNDS.maxX, PLAY_SPACE_BOUNDS.minZ, NEON.orange],
    [PLAY_SPACE_BOUNDS.minX, PLAY_SPACE_BOUNDS.maxZ, NEON.cyan],
    [PLAY_SPACE_BOUNDS.maxX, PLAY_SPACE_BOUNDS.maxZ, NEON.lime],
  ] as const) {
    out.push(
      block({ x, z, passable: false, pyramid: true, colorRgb: c })
    );
  }

  // Hex totem ring (staggered, not a perfect circle)
  const totems: [number, number][] = [
    [-7, -3],
    [-7, 2],
    [-4, -5],
    [-4, 5],
    [4, -5],
    [4, 5],
    [7, -2],
    [7, 4],
    [-2, -4],
    [3, 4],
    [-6, 0],
    [6, -4],
  ];
  for (const [x, z] of totems) {
    if (!inBounds(x, z)) continue;
    if (x === 0 && z === 0) continue;
    out.push(
      block({
        x,
        z,
        passable: false,
        hex: true,
        colorRgb: wildColor(x, z, 1),
      })
    );
  }

  // Floating orbs (sphere columns)
  for (const [x, z] of [
    [-5, -1],
    [5, 1],
    [-1, 3],
    [2, -3],
    [-3, -5],
    [5, -2],
  ] as const) {
    out.push(
      block({
        x,
        z,
        passable: false,
        sphere: true,
        colorRgb: wildColor(x, z, 2),
      })
    );
  }

  // Stepping-stone path (walkable half-slabs) — spiral toward center
  for (const [x, z] of [
    [-6, 4],
    [-5, 3],
    [-4, 2],
    [-3, 1],
    [-2, 0],
    [-1, -1],
    [1, -2],
    [2, -1],
    [3, 0],
    [4, 1],
    [5, 2],
    [6, 3],
    [7, 2],
    [6, -1],
    [-7, 1],
  ] as const) {
    out.push(
      block({
        x,
        z,
        passable: true,
        half: true,
        colorRgb: wildColor(x, z, 3),
      })
    );
  }

  // Ramp bridges over the “moat” tiles
  for (const [x, z, rampDir] of [
    [-8, -2, 1],
    [8, 2, 3],
    [0, -6, 1],
    [-2, 6, 3],
  ] as const) {
    out.push(
      block({
        x,
        z,
        passable: true,
        ramp: true,
        rampDir,
        colorRgb: NEON.gold,
      })
    );
  }

  // Center dance floor — low, walkable, hot pink
  out.push(
    block({
      x: 0,
      z: 0,
      passable: true,
      quarter: true,
      colorRgb: NEON.pink,
    })
  );

  // Stacked “lightning” stacks on the sides (y=1 accents)
  for (const [x, z, y, c] of [
    [-8, 0, 1, NEON.aqua],
    [8, -1, 1, NEON.grape],
    [0, 6, 1, NEON.coral],
    [0, -6, 1, NEON.indigo],
  ] as const) {
    out.push(
      block({
        x,
        z,
        y,
        passable: false,
        quarter: true,
        colorRgb: c,
      })
    );
  }

  // Inner pyramid “altars” (walk around them)
  for (const [x, z, c] of [
    [-3, 0, NEON.orange],
    [3, 0, NEON.cyan],
    [0, 3, NEON.violet],
    [0, -3, NEON.lime],
  ] as const) {
    out.push(
      block({ x, z, passable: false, pyramid: true, colorRgb: c })
    );
  }

  return out;
}

export const PLAY_SPACE_BLOCKS: readonly PlaySpaceBlockSpec[] = buildWildBlocks();

/** Full-floor neon checkerboard — every tile painted. */
export const PLAY_SPACE_FLOOR_TINTS: readonly PlaySpaceFloorTint[] = (() => {
  const out: PlaySpaceFloorTint[] = [];
  for (let x = PLAY_SPACE_BOUNDS.minX; x <= PLAY_SPACE_BOUNDS.maxX; x++) {
    for (let z = PLAY_SPACE_BOUNDS.minZ; z <= PLAY_SPACE_BOUNDS.maxZ; z++) {
      const checker = (x + z) % 2 === 0;
      const ring = Math.abs(x) + Math.abs(z);
      const color =
        ring <= 2
          ? NEON.pink
          : checker
            ? wildColor(x, z, 4)
            : wildColor(x, z, 5);
      out.push({ x, z, colorRgb: color });
    }
  }
  return out;
})();

/** Deep violet sky — lets the floor pop. */
export const PLAY_SPACE_BACKGROUND_HUE_DEG = 285;
