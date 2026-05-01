import { getRoomBaseBounds } from "./roomLayouts.js";

/** Integer tile indices on the floor plane: x = column (world X), y = row (world Z). */
export type FloorTile = { x: number; y: number };

/** Inclusive tile coordinate bounds: 500×500 grid (–250…249 on each axis). */
export const TILE_COORD_MIN = -250;
export const TILE_COORD_MAX = 249;

function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v));
}

export function inTileBounds(x: number, z: number): boolean {
  return (
    x >= TILE_COORD_MIN &&
    x <= TILE_COORD_MAX &&
    z >= TILE_COORD_MIN &&
    z <= TILE_COORD_MAX
  );
}

export function isBaseTile(x: number, z: number, roomId: string): boolean {
  const b = getRoomBaseBounds(roomId);
  return (
    x >= b.minX &&
    x <= b.maxX &&
    z >= b.minZ &&
    z <= b.maxZ
  );
}

/** Tile is walkable: base floor for this room or an extra floor tile (within world bounds). */
export function isWalkableTile(
  x: number,
  z: number,
  extraWalkable: ReadonlySet<string>,
  roomId: string,
  /** Base tiles carved out in custom rooms (tileKey); omit when none. */
  baseRemoved?: ReadonlySet<string> | null
): boolean {
  if (!inTileBounds(x, z)) {
    return false;
  }
  const k = tileKey(x, z);
  if (isBaseTile(x, z, roomId)) {
    if (baseRemoved?.has(k)) return false;
    return true;
  }
  return extraWalkable.has(k);
}

export function snapToTile(x: number, z: number): { x: number; z: number } {
  return {
    x: Math.round(clamp(x, TILE_COORD_MIN, TILE_COORD_MAX)),
    z: Math.round(clamp(z, TILE_COORD_MIN, TILE_COORD_MAX)),
  };
}

/** Cardinal adjacency on integer tiles (Manhattan distance 1); excludes diagonals. */
export function isOrthogonallyAdjacentToTile(
  playerX: number,
  playerZ: number,
  tileX: number,
  tileZ: number
): boolean {
  const t = snapToTile(playerX, playerZ);
  return Math.abs(t.x - tileX) + Math.abs(t.z - tileZ) === 1;
}

/**
 * Orthogonal path along tile centers (horizontal first, then vertical).
 * World floor uses X and Z; each step is one adjacent tile edge (Manhattan).
 */
export function tileKey(x: number, z: number): string {
  return `${x},${z}`;
}

/** Unique key for a placed obstacle instance at tile + vertical level (0..2). */
export function blockKey(x: number, z: number, y: number): string {
  return `${x},${z},${y}`;
}

export function manhattanPathTiles(
  sx: number,
  sz: number,
  tx: number,
  tz: number
): { x: number; z: number }[] {
  const path: { x: number; z: number }[] = [];
  let x = sx;
  let z = sz;
  path.push({ x, z });
  while (x !== tx) {
    x += Math.sign(tx - x);
    path.push({ x, z });
  }
  while (z !== tz) {
    z += Math.sign(tz - z);
    path.push({ x, z });
  }
  return path;
}

/** Cardinal + diagonal steps (same step count in BFS; diagonals shorten many routes). */
const DIRS8: readonly [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

function isPassableTile(
  x: number,
  z: number,
  blocked: ReadonlySet<string>,
  extraWalkable: ReadonlySet<string>,
  roomId: string,
  baseRemoved?: ReadonlySet<string> | null
): boolean {
  if (!isWalkableTile(x, z, extraWalkable, roomId, baseRemoved)) return false;
  if (blocked.has(tileKey(x, z))) return false;
  return true;
}

/** Safety cap for very large maps (500×500 worst-case search space). */
const PATHFIND_MAX_STEPS = 500_000;

/**
 * 8-neighbour BFS (cardinal + diagonal). Diagonal moves require both adjacent
 * cardinal tiles to be passable so we never cut through a blocked corner.
 * `blocked` = solid obstacle keys; `extraWalkable` = extra floor outside the base room.
 */
export function pathfindTiles(
  sx: number,
  sz: number,
  tx: number,
  tz: number,
  blocked: ReadonlySet<string>,
  extraWalkable: ReadonlySet<string>,
  roomId: string,
  baseRemoved?: ReadonlySet<string> | null
): { x: number; z: number }[] | null {
  const sk = tileKey(sx, sz);
  const gk = tileKey(tx, tz);
  if (
    !isWalkableTile(sx, sz, extraWalkable, roomId, baseRemoved) ||
    !isWalkableTile(tx, tz, extraWalkable, roomId, baseRemoved)
  ) {
    return null;
  }
  if (blocked.has(gk) || blocked.has(sk)) return null;

  const queue: { x: number; z: number }[] = [{ x: sx, z: sz }];
  const cameFrom = new Map<string, string | null>();
  cameFrom.set(sk, null);
  let steps = 0;

  while (queue.length > 0) {
    if (++steps > PATHFIND_MAX_STEPS) {
      return null;
    }
    const cur = queue.shift()!;
    const ck = tileKey(cur.x, cur.z);
    if (ck === gk) {
      const out: { x: number; z: number }[] = [];
      let k: string | null = gk;
      while (k !== null) {
        const [x, z] = k.split(",").map(Number);
        out.unshift({ x: x!, z: z! });
        k = cameFrom.get(k) ?? null;
      }
      return out;
    }
    for (const [dx, dz] of DIRS8) {
      const nx = cur.x + dx;
      const nz = cur.z + dz;
      if (!isWalkableTile(nx, nz, extraWalkable, roomId, baseRemoved)) continue;
      const nk = tileKey(nx, nz);
      if (cameFrom.has(nk)) continue;
      if (blocked.has(nk)) continue;
      if (dx !== 0 && dz !== 0) {
        if (!isPassableTile(cur.x + dx, cur.z, blocked, extraWalkable, roomId, baseRemoved))
          continue;
        if (!isPassableTile(cur.x, cur.z + dz, blocked, extraWalkable, roomId, baseRemoved))
          continue;
      }
      cameFrom.set(nk, ck);
      queue.push({ x: nx, z: nz });
    }
  }
  return null;
}

/** Match client block vertical extent (world units). */
const BLOCK_SIZE = 0.82;

export type TerrainProps = {
  passable: boolean;
  half: boolean;
  quarter: boolean;
  hex: boolean;
  ramp: boolean;
  rampDir: number;
  colorId: number;
  locked?: boolean;
  /**
   * One-way teleporter: `pending` until destination is set; then warps to target tile.
   */
  teleporter?:
    | { pending: true }
    | { targetRoomId: string; targetX: number; targetZ: number };
  // Experimental: Claimable/minable blocks
  claimable?: boolean;
  active?: boolean;
  cooldownMs?: number; // Cooldown period in milliseconds
  lastClaimedAt?: number; // Timestamp of last claim
  /** When `active` becomes true again (persisted; survives process restarts). */
  claimReactivateAtMs?: number;
  claimedBy?: string; // Address of player who last claimed
};

export function terrainObstacleHeight(p: TerrainProps): number {
  if (p.quarter) return BLOCK_SIZE * 0.25;
  if (p.half) return BLOCK_SIZE * 0.5;
  return BLOCK_SIZE;
}

function isSolidTerrain(p: TerrainProps | undefined): p is TerrainProps {
  return p != null && !p.passable && !p.ramp;
}

function floorLevelTerrain(
  placed: ReadonlyMap<string, TerrainProps>,
  x: number,
  z: number
): TerrainProps | undefined {
  return placed.get(tileKey(x, z)) ?? placed.get(blockKey(x, z, 0));
}

function hasStackBlockAtLevel(
  placed: ReadonlyMap<string, TerrainProps>,
  x: number,
  z: number,
  y: number
): boolean {
  return placed.has(blockKey(x, z, y));
}

/** Level-1 path node is top of level-0 solid only when not occupied by a stacked block. */
function level1SurfaceOpen(
  placed: ReadonlyMap<string, TerrainProps>,
  x: number,
  z: number
): boolean {
  const base = floorLevelTerrain(placed, x, z);
  if (!isSolidTerrain(base)) return false;
  return !hasStackBlockAtLevel(placed, x, z, 1);
}

export function floorWalkableTerrain(
  x: number,
  z: number,
  placed: ReadonlyMap<string, TerrainProps>,
  extraWalkable: ReadonlySet<string>,
  roomId: string,
  baseRemoved?: ReadonlySet<string> | null
): boolean {
  if (!isWalkableTile(x, z, extraWalkable, roomId, baseRemoved)) return false;
  const p = placed.get(tileKey(x, z)) ?? placed.get(blockKey(x, z, 0));
  if (!p) return true;
  if (p.passable || p.ramp) return true;
  return false;
}

/** Empty walkable floor tile suitable for placing a passable teleporter obstacle. */
export function canPlaceTeleporterFoot(
  roomId: string,
  x: number,
  z: number,
  placed: ReadonlyMap<string, TerrainProps>,
  extraWalkable: ReadonlySet<string>,
  baseRemoved?: ReadonlySet<string> | null
): boolean {
  if (!floorWalkableTerrain(x, z, placed, extraWalkable, roomId, baseRemoved)) return false;
  const prefix = `${x},${z},`;
  for (const key of placed.keys()) {
    if (key.startsWith(prefix)) return false;
  }
  return true;
}

const RAMP_NEIGHBOR: readonly [number, number][] = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];

function terrainNodeKey(x: number, z: number, layer: 0 | 1): string {
  return `${x}|${z}|${layer}`;
}

/** Ramp tile at (rx,rz) slopes toward the neighboring solid at (sx,sz). */
function rampFacesSolid(
  p: TerrainProps | undefined,
  rx: number,
  rz: number,
  solidX: number,
  solidZ: number
): boolean {
  if (!p?.ramp) return false;
  const dir = RAMP_NEIGHBOR[p.rampDir & 3]!;
  return rx + dir[0] === solidX && rz + dir[1] === solidZ;
}

/**
 * Floor layer may only step onto a ramp tile from the low-side neighbor (opposite `rampDir`),
 * walking in the same direction the ramp faces (toward the solid). Entering from the sides or
 * from behind the solid is not allowed.
 */
function canEnterRampFrom(
  curX: number,
  curZ: number,
  rampX: number,
  rampZ: number,
  ramp: TerrainProps
): boolean {
  if (!ramp.ramp) return true;
  const [rdx, rdz] = RAMP_NEIGHBOR[ramp.rampDir & 3]!;
  return curX === rampX - rdx && curZ === rampZ - rdz;
}

function isValidTerrainGoal(
  tx: number,
  tz: number,
  goalLayer: 0 | 1,
  placed: ReadonlyMap<string, TerrainProps>,
  extraWalkable: ReadonlySet<string>,
  roomId: string,
  baseRemoved?: ReadonlySet<string> | null
): boolean {
  if (goalLayer === 0) {
    return floorWalkableTerrain(tx, tz, placed, extraWalkable, roomId, baseRemoved);
  }
  return level1SurfaceOpen(placed, tx, tz);
}

/**
 * Pathfind with floor (layer 0) and block tops (layer 1). Ramps connect floor to a
 * neighboring solid block's top. On floor, you may only **enter** a ramp tile from the
 * low-side neighbor (opposite `rampDir`), walking toward the solid. Descent from a block
 * top to the floor is only allowed onto an adjacent ramp that faces that solid.
 */
export function pathfindTerrain(
  sx: number,
  sz: number,
  startLayer: 0 | 1,
  tx: number,
  tz: number,
  goalLayer: 0 | 1,
  placed: ReadonlyMap<string, TerrainProps>,
  extraWalkable: ReadonlySet<string>,
  roomId: string,
  baseRemoved?: ReadonlySet<string> | null
): { x: number; z: number; layer: 0 | 1 }[] | null {
  if (!isValidTerrainGoal(tx, tz, goalLayer, placed, extraWalkable, roomId, baseRemoved)) {
    return null;
  }
  if (startLayer === 0) {
    if (!floorWalkableTerrain(sx, sz, placed, extraWalkable, roomId, baseRemoved))
      return null;
  } else {
    if (!level1SurfaceOpen(placed, sx, sz)) return null;
  }

  const startKey = terrainNodeKey(sx, sz, startLayer);
  const goalKey = terrainNodeKey(tx, tz, goalLayer);

  const queue: { x: number; z: number; layer: 0 | 1 }[] = [
    { x: sx, z: sz, layer: startLayer },
  ];
  const cameFrom = new Map<string, string | null>();
  cameFrom.set(startKey, null);
  let steps = 0;

  while (queue.length > 0) {
    if (++steps > PATHFIND_MAX_STEPS) return null;
    const cur = queue.shift()!;
    const ck = terrainNodeKey(cur.x, cur.z, cur.layer);
    if (ck === goalKey) {
      const out: { x: number; z: number; layer: 0 | 1 }[] = [];
      let k: string | null = ck;
      while (k !== null) {
        const parts = k.split("|");
        const xs = Number(parts[0]);
        const zs = Number(parts[1]);
        const ls = Number(parts[2]) as 0 | 1;
        out.unshift({ x: xs, z: zs, layer: ls });
        k = cameFrom.get(k) ?? null;
      }
      return out;
    }

    if (cur.layer === 0) {
      for (const [dx, dz] of DIRS8) {
        const nx = cur.x + dx;
        const nz = cur.z + dz;
        if (!isWalkableTile(nx, nz, extraWalkable, roomId, baseRemoved)) continue;
        const n0 = terrainNodeKey(nx, nz, 0);
        if (cameFrom.has(n0)) continue;
        if (!floorWalkableTerrain(nx, nz, placed, extraWalkable, roomId, baseRemoved))
          continue;
        const pTarget = floorLevelTerrain(placed, nx, nz);
        if (
          pTarget?.ramp &&
          !canEnterRampFrom(cur.x, cur.z, nx, nz, pTarget)
        ) {
          continue;
        }
        if (dx !== 0 && dz !== 0) {
          if (
            !floorWalkableTerrain(
              cur.x + dx,
              cur.z,
              placed,
              extraWalkable,
              roomId,
              baseRemoved
            )
          )
            continue;
          if (
            !floorWalkableTerrain(
              cur.x,
              cur.z + dz,
              placed,
              extraWalkable,
              roomId,
              baseRemoved
            )
          )
            continue;
        }
        cameFrom.set(n0, ck);
        queue.push({ x: nx, z: nz, layer: 0 });
      }

      const pr = floorLevelTerrain(placed, cur.x, cur.z);
      if (pr?.ramp) {
        const dir = RAMP_NEIGHBOR[pr.rampDir & 3]!;
        const nx = cur.x + dir[0]!;
        const nz = cur.z + dir[1]!;
        const np = floorLevelTerrain(placed, nx, nz);
        if (isSolidTerrain(np) && level1SurfaceOpen(placed, nx, nz)) {
          const topKey = terrainNodeKey(nx, nz, 1);
          if (!cameFrom.has(topKey)) {
            cameFrom.set(topKey, ck);
            queue.push({ x: nx, z: nz, layer: 1 });
          }
        }
      }
    } else {
      const pHere = floorLevelTerrain(placed, cur.x, cur.z);
      if (!isSolidTerrain(pHere)) continue;
      const h0 = terrainObstacleHeight(pHere);

      for (const [dx, dz] of RAMP_NEIGHBOR) {
        const nx = cur.x + dx;
        const nz = cur.z + dz;
        if (!isWalkableTile(nx, nz, extraWalkable, roomId, baseRemoved)) continue;
        const pN = floorLevelTerrain(placed, nx, nz);
        if (
          floorWalkableTerrain(nx, nz, placed, extraWalkable, roomId, baseRemoved) &&
          rampFacesSolid(pN, nx, nz, cur.x, cur.z)
        ) {
          const fk = terrainNodeKey(nx, nz, 0);
          if (!cameFrom.has(fk)) {
            cameFrom.set(fk, ck);
            queue.push({ x: nx, z: nz, layer: 0 });
          }
        }
        if (isSolidTerrain(pN) && level1SurfaceOpen(placed, nx, nz)) {
          if (terrainObstacleHeight(pN) === h0) {
            const tk = terrainNodeKey(nx, nz, 1);
            if (!cameFrom.has(tk)) {
              cameFrom.set(tk, ck);
              queue.push({ x: nx, z: nz, layer: 1 });
            }
          }
        }
      }
    }
  }
  return null;
}

/** Legacy paired teleporters stored `pairId`; strip on load. */
export function normalizeTeleporterPropsForLoad(p: TerrainProps): TerrainProps {
  const tp = p.teleporter;
  if (!tp) return p;
  if ("pending" in tp && tp.pending) return p;
  if ("pairId" in tp) {
    const t = tp as {
      pairId: string;
      targetRoomId: string;
      targetX: number;
      targetZ: number;
    };
    return {
      ...p,
      teleporter: {
        targetRoomId: t.targetRoomId,
        targetX: t.targetX,
        targetZ: t.targetZ,
      },
    };
  }
  return p;
}
