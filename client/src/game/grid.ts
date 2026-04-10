import { getRoomBaseBounds } from "./roomLayouts.js";
import { TILE_COORD_MAX, TILE_COORD_MIN } from "./constants.js";

/**
 * Integer coordinates of a floor tile: `x` = column (world X), `y` = row (world Z).
 * (Named x/y for the 2D grid; Three.js floor height is still world Y.)
 */
export type FloorTile = { x: number; y: number };

export function tileKey(x: number, y: number): string {
  return `${x},${y}`;
}

export function isBaseTile(x: number, y: number, roomId: string): boolean {
  const b = getRoomBaseBounds(roomId);
  return (
    x >= b.minX &&
    x <= b.maxX &&
    y >= b.minZ &&
    y <= b.maxZ
  );
}

/** Walkable: base floor for this room or an extra tile outside it (within tile bounds). */
export function isWalkableTile(
  x: number,
  y: number,
  extraWalkable: ReadonlySet<string>,
  roomId: string
): boolean {
  if (
    x < TILE_COORD_MIN ||
    x > TILE_COORD_MAX ||
    y < TILE_COORD_MIN ||
    y > TILE_COORD_MAX
  ) {
    return false;
  }
  if (isBaseTile(x, y, roomId)) return true;
  return extraWalkable.has(tileKey(x, y));
}

export function snapFloorTile(wx: number, wz: number): FloorTile {
  const x = Math.round(
    Math.max(TILE_COORD_MIN, Math.min(TILE_COORD_MAX, wx))
  );
  const y = Math.round(
    Math.max(TILE_COORD_MIN, Math.min(TILE_COORD_MAX, wz))
  );
  return { x, y };
}

/**
 * Orthogonal path along tile centers (horizontal first, then vertical).
 * Same rules as the server when there are no obstacles.
 */
export function manhattanPathTiles(
  sx: number,
  sy: number,
  tx: number,
  ty: number
): FloorTile[] {
  const path: FloorTile[] = [];
  let x = sx;
  let y = sy;
  path.push({ x, y });
  while (x !== tx) {
    x += Math.sign(tx - x);
    path.push({ x, y });
  }
  while (y !== ty) {
    y += Math.sign(ty - y);
    path.push({ x, y });
  }
  return path;
}

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
  y: number,
  blocked: ReadonlySet<string>,
  extraWalkable: ReadonlySet<string>,
  roomId: string
): boolean {
  if (!isWalkableTile(x, y, extraWalkable, roomId)) return false;
  if (blocked.has(tileKey(x, y))) return false;
  return true;
}

const PATHFIND_MAX_STEPS = 500_000;

/**
 * 8-neighbour BFS; diagonal steps require both flanking cardinals passable (no corner cutting).
 */
export function pathfindTiles(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  blocked: ReadonlySet<string>,
  extraWalkable: ReadonlySet<string>,
  roomId: string
): FloorTile[] | null {
  const sk = tileKey(sx, sy);
  const gk = tileKey(tx, ty);
  if (
    !isWalkableTile(sx, sy, extraWalkable, roomId) ||
    !isWalkableTile(tx, ty, extraWalkable, roomId)
  ) {
    return null;
  }
  if (blocked.has(gk) || blocked.has(sk)) return null;

  const queue: FloorTile[] = [{ x: sx, y: sy }];
  const cameFrom = new Map<string, string | null>();
  cameFrom.set(sk, null);
  let steps = 0;

  while (queue.length > 0) {
    if (++steps > PATHFIND_MAX_STEPS) {
      return null;
    }
    const cur = queue.shift()!;
    const ck = tileKey(cur.x, cur.y);
    if (ck === gk) {
      const out: FloorTile[] = [];
      let k: string | null = gk;
      while (k !== null) {
        const [x, y] = k.split(",").map(Number);
        out.unshift({ x: x!, y: y! });
        k = cameFrom.get(k) ?? null;
      }
      return out;
    }
    for (const [dx, dy] of DIRS8) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      if (!isWalkableTile(nx, ny, extraWalkable, roomId)) continue;
      const nk = tileKey(nx, ny);
      if (cameFrom.has(nk)) continue;
      if (blocked.has(nk)) continue;
      if (dx !== 0 && dy !== 0) {
        if (
          !isPassableTile(cur.x + dx, cur.y, blocked, extraWalkable, roomId)
        )
          continue;
        if (
          !isPassableTile(cur.x, cur.y + dy, blocked, extraWalkable, roomId)
        )
          continue;
      }
      cameFrom.set(nk, ck);
      queue.push({ x: nx, y: ny });
    }
  }
  return null;
}

/** Match server block vertical extent (world units). */
const TERRAIN_BLOCK = 0.82;

export type TerrainProps = {
  passable: boolean;
  half: boolean;
  quarter: boolean;
  hex: boolean;
  ramp: boolean;
  rampDir: number;
  colorId: number;
};

export function terrainObstacleHeight(p: TerrainProps): number {
  if (p.quarter) return TERRAIN_BLOCK * 0.25;
  if (p.half) return TERRAIN_BLOCK * 0.5;
  return TERRAIN_BLOCK;
}

function isSolidTerrain(p: TerrainProps | undefined): p is TerrainProps {
  return p != null && !p.passable && !p.ramp;
}

function floorWalkableTerrain(
  x: number,
  z: number,
  placed: ReadonlyMap<string, TerrainProps>,
  extraWalkable: ReadonlySet<string>,
  roomId: string
): boolean {
  if (!isWalkableTile(x, z, extraWalkable, roomId)) return false;
  const p = placed.get(tileKey(x, z));
  if (!p) return true;
  if (p.passable || p.ramp) return true;
  return false;
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

/** Match server: only enter a ramp tile from the low-side neighbor (opposite `rampDir`). */
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
  roomId: string
): boolean {
  if (goalLayer === 0) {
    return floorWalkableTerrain(tx, tz, placed, extraWalkable, roomId);
  }
  return isSolidTerrain(placed.get(tileKey(tx, tz)));
}

export function inferStartLayerClient(
  wx: number,
  wz: number,
  wy: number,
  placed: ReadonlyMap<string, TerrainProps>
): 0 | 1 {
  const t = snapFloorTile(wx, wz);
  const k = tileKey(t.x, t.y);
  const prop = placed.get(k);
  if (!prop) return 0;
  if (prop.passable || prop.ramp) return 0;
  const h = terrainObstacleHeight(prop);
  if (wy >= h - 0.2) return 1;
  return 0;
}

export function waypointWorldY(
  layer: 0 | 1,
  gx: number,
  gz: number,
  placed: ReadonlyMap<string, TerrainProps>
): number {
  if (layer === 0) return 0;
  const p = placed.get(tileKey(gx, gz));
  if (!p || p.passable || p.ramp) return 0;
  return terrainObstacleHeight(p);
}

/**
 * Same rules as server `pathfindTerrain` (including ramp entry from low side only);
 * second coordinate is world Z (`FloorTile.y`).
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
  roomId: string
): { x: number; z: number; layer: 0 | 1 }[] | null {
  if (!isValidTerrainGoal(tx, tz, goalLayer, placed, extraWalkable, roomId)) {
    return null;
  }
  const sk = tileKey(sx, sz);

  if (startLayer === 0) {
    if (!floorWalkableTerrain(sx, sz, placed, extraWalkable, roomId)) return null;
  } else {
    if (!isSolidTerrain(placed.get(sk))) return null;
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
        if (!isWalkableTile(nx, nz, extraWalkable, roomId)) continue;
        const n0 = terrainNodeKey(nx, nz, 0);
        if (cameFrom.has(n0)) continue;
        if (!floorWalkableTerrain(nx, nz, placed, extraWalkable, roomId)) continue;
        const pTarget = placed.get(tileKey(nx, nz));
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
              roomId
            )
          )
            continue;
          if (
            !floorWalkableTerrain(
              cur.x,
              cur.z + dz,
              placed,
              extraWalkable,
              roomId
            )
          )
            continue;
        }
        cameFrom.set(n0, ck);
        queue.push({ x: nx, z: nz, layer: 0 });
      }

      const pr = placed.get(tileKey(cur.x, cur.z));
      if (pr?.ramp) {
        const dir = RAMP_NEIGHBOR[pr.rampDir & 3]!;
        const nx = cur.x + dir[0]!;
        const nz = cur.z + dir[1]!;
        const np = placed.get(tileKey(nx, nz));
        if (isSolidTerrain(np)) {
          const topKey = terrainNodeKey(nx, nz, 1);
          if (!cameFrom.has(topKey)) {
            cameFrom.set(topKey, ck);
            queue.push({ x: nx, z: nz, layer: 1 });
          }
        }
      }
    } else {
      const pHere = placed.get(tileKey(cur.x, cur.z));
      if (!isSolidTerrain(pHere)) continue;
      const h0 = terrainObstacleHeight(pHere);

      for (const [dx, dz] of RAMP_NEIGHBOR) {
        const nx = cur.x + dx;
        const nz = cur.z + dz;
        const nk = tileKey(nx, nz);
        if (!isWalkableTile(nx, nz, extraWalkable, roomId)) continue;
        const pN = placed.get(nk);
        if (
          floorWalkableTerrain(nx, nz, placed, extraWalkable, roomId) &&
          rampFacesSolid(pN, nx, nz, cur.x, cur.z)
        ) {
          const fk = terrainNodeKey(nx, nz, 0);
          if (!cameFrom.has(fk)) {
            cameFrom.set(fk, ck);
            queue.push({ x: nx, z: nz, layer: 0 });
          }
        }
        if (isSolidTerrain(pN)) {
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
