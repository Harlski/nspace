import {
  CANVAS_ROOM_ID,
  getRoomBaseBounds,
  HUB_ROOM_ID,
  isHubSpawnSafeZone,
  normalizeRoomId,
} from "./roomLayouts.js";
import { TILE_COORD_MAX, TILE_COORD_MIN } from "./constants.js";

/**
 * Integer coordinates of a floor tile: `x` = column (world X), `y` = row (world Z).
 * (Named x/y for the 2D grid; Three.js floor height is still world Y.)
 */
export type FloorTile = { x: number; y: number };

export function tileKey(x: number, y: number): string {
  return `${x},${y}`;
}

/** Unique key for a placed obstacle instance at tile + vertical level (0..2). */
export function blockKey(x: number, z: number, yLevel: number): string {
  return `${x},${z},${yLevel}`;
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
  roomId: string,
  baseRemoved?: ReadonlySet<string> | null
): boolean {
  if (
    x < TILE_COORD_MIN ||
    x > TILE_COORD_MAX ||
    y < TILE_COORD_MIN ||
    y > TILE_COORD_MAX
  ) {
    return false;
  }
  const k = tileKey(x, y);
  if (isBaseTile(x, y, roomId)) {
    if (baseRemoved?.has(k)) return false;
    return true;
  }
  return extraWalkable.has(k);
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

/** Cardinal adjacency: player's snapped floor tile shares an edge with the block tile (not diagonal). */
export function isOrthogonallyAdjacentToFloorTile(
  wx: number,
  wz: number,
  blockX: number,
  blockZ: number
): boolean {
  const t = snapFloorTile(wx, wz);
  return Math.abs(t.x - blockX) + Math.abs(t.y - blockZ) === 1;
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

/** Cardinal-only for terrain floor (layer 0); matches server `pathfindTerrain`. */
const DIRS4: readonly [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

function isPassableTile(
  x: number,
  y: number,
  blocked: ReadonlySet<string>,
  extraWalkable: ReadonlySet<string>,
  roomId: string,
  baseRemoved?: ReadonlySet<string> | null
): boolean {
  if (!isWalkableTile(x, y, extraWalkable, roomId, baseRemoved)) return false;
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
  roomId: string,
  baseRemoved?: ReadonlySet<string> | null
): FloorTile[] | null {
  const sk = tileKey(sx, sy);
  const gk = tileKey(tx, ty);
  if (
    !isWalkableTile(sx, sy, extraWalkable, roomId, baseRemoved) ||
    !isWalkableTile(tx, ty, extraWalkable, roomId, baseRemoved)
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
      if (!isWalkableTile(nx, ny, extraWalkable, roomId, baseRemoved)) continue;
      const nk = tileKey(nx, ny);
      if (cameFrom.has(nk)) continue;
      if (blocked.has(nk)) continue;
      if (dx !== 0 && dy !== 0) {
        if (
          !isPassableTile(
            cur.x + dx,
            cur.y,
            blocked,
            extraWalkable,
            roomId,
            baseRemoved
          )
        )
          continue;
        if (
          !isPassableTile(
            cur.x,
            cur.y + dy,
            blocked,
            extraWalkable,
            roomId,
            baseRemoved
          )
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
  pyramid: boolean;
  /** Pyramid only; default 1 when omitted. */
  pyramidBaseScale?: number;
  sphere: boolean;
  ramp: boolean;
  rampDir: number;
  colorId: number;
  teleporter?:
    | { pending: true }
    | {
        targetRoomId: string;
        targetX: number;
        targetZ: number;
        targetRoomDisplayName?: string;
      };
  gate?: {
    adminAddress?: string;
    authorizedAddress?: string;
    authorizedAddresses?: string[];
    exitX: number;
    exitZ: number;
  };
  gateOpen?: {
    openedBy: string;
    untilMs: number;
  };
};

export function normalizeWalletKey(addr: string): string {
  return String(addr).replace(/\s+/g, "").toUpperCase();
}

export function isGatePassableForMover(
  p: TerrainProps | undefined,
  moverAddress: string | null,
  nowMs: number,
  roomId?: string
): boolean {
  if (!p?.gate || !p.gateOpen) return false;
  if (nowMs >= p.gateOpen.untilMs) return false;
  if (!moverAddress) return false;
  if (
    roomId !== undefined &&
    normalizeRoomId(roomId) === HUB_ROOM_ID
  ) {
    return true;
  }
  return (
    normalizeWalletKey(moverAddress) ===
    normalizeWalletKey(p.gateOpen.openedBy)
  );
}

export function terrainObstacleHeight(p: TerrainProps): number {
  if (p.quarter) return TERRAIN_BLOCK * 0.25;
  if (p.half) return TERRAIN_BLOCK * 0.5;
  return TERRAIN_BLOCK;
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
export function level1SurfaceOpen(
  placed: ReadonlyMap<string, TerrainProps>,
  x: number,
  z: number
): boolean {
  const base = floorLevelTerrain(placed, x, z);
  if (!isSolidTerrain(base)) return false;
  /** Gates are passages, not standable platforms; matches server (see `server/src/grid.ts`). */
  if (base.gate) return false;
  return !hasStackBlockAtLevel(placed, x, z, 1);
}

const TILE_COLUMN_HALF = 0.5;
const STAND_ON_TOP_BELOW = 0.22;
const STAND_ON_TOP_ABOVE = 0.5;

function inWorldTileBounds(x: number, z: number): boolean {
  return (
    x >= TILE_COORD_MIN &&
    x <= TILE_COORD_MAX &&
    z >= TILE_COORD_MIN &&
    z <= TILE_COORD_MAX
  );
}

/**
 * Same logic as server `inferTerrainStartLayer` (see server `grid.ts`).
 */
export type PathfindMoverContext = { address: string; nowMs: number };

export function inferTerrainStartLayer(
  wx: number,
  wz: number,
  wy: number,
  placed: ReadonlyMap<string, TerrainProps>,
  moverCtx?: PathfindMoverContext | null,
  roomId?: string
): 0 | 1 {
  const t = snapFloorTile(wx, wz);
  const propHere = floorLevelTerrain(placed, t.x, t.y);
  if (propHere?.ramp) return 0;
  if (propHere && !propHere.passable && !propHere.ramp) {
    if (
      moverCtx &&
      isGatePassableForMover(
        propHere,
        moverCtx.address,
        moverCtx.nowMs,
        roomId
      )
    ) {
      return 0;
    }
    if (propHere.gate) return 0;
    const h = terrainObstacleHeight(propHere);
    if (wy >= h - STAND_ON_TOP_BELOW) return 1;
    return 0;
  }
  if (wy < 0.06) return 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const sx = t.x + dx;
      const sz = t.y + dy;
      if (!inWorldTileBounds(sx, sz)) continue;
      if (
        Math.max(Math.abs(wx - sx), Math.abs(wz - sz)) >
        TILE_COLUMN_HALF + 1e-3
      ) {
        continue;
      }
      const prop = floorLevelTerrain(placed, sx, sz);
      if (!prop || prop.passable || prop.ramp) continue;
      if (!level1SurfaceOpen(placed, sx, sz)) continue;
      const h = terrainObstacleHeight(prop);
      if (
        wy >= h - STAND_ON_TOP_BELOW &&
        wy <= h + STAND_ON_TOP_ABOVE
      ) {
        return 1;
      }
    }
  }
  return 0;
}

/** Layer-0 floor where avatars can stand (empty tile or passable/ramp obstacle). Used for pathfinding and build hints. */
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

/**
 * Per-neighbor clearance for a gate at `(gx,gz)` with exit tile `(ex,ez)` (cardinal neighbor).
 * **Walkability** here is for green/red hints only; server placement allows unwalkable exit/front.
 */
export function gatePassageNeighborHintsOk(opts: {
  roomId: string;
  gx: number;
  gz: number;
  ex: number;
  ez: number;
  placed: ReadonlyMap<string, TerrainProps>;
  extraWalkable: ReadonlySet<string>;
  baseRemoved?: ReadonlySet<string> | null;
  signboardOnGateTile: boolean;
  playerOnTile: (x: number, z: number) => boolean;
}): { exitOk: boolean; frontOk: boolean } {
  const nRoom = normalizeRoomId(opts.roomId);
  if (nRoom === CANVAS_ROOM_ID) {
    return { exitOk: false, frontOk: false };
  }
  const { gx, gz, ex, ez } = opts;
  const adj =
    Math.abs(ex - gx) + Math.abs(ez - gz) === 1 &&
    inWorldTileBounds(gx, gz) &&
    inWorldTileBounds(ex, ez);
  if (!adj) {
    return { exitOk: false, frontOk: false };
  }
  const frontX = gx * 2 - ex;
  const frontZ = gz * 2 - ez;
  const frontAdj =
    Math.abs(frontX - gx) + Math.abs(frontZ - gz) === 1 &&
    inWorldTileBounds(frontX, frontZ);
  if (!frontAdj) {
    return { exitOk: false, frontOk: false };
  }

  const anchorOk =
    !opts.signboardOnGateTile &&
    !(nRoom === HUB_ROOM_ID && isHubSpawnSafeZone(gx, gz)) &&
    !opts.playerOnTile(gx, gz);

  const exitOk =
    anchorOk &&
    floorWalkableTerrain(
      ex,
      ez,
      opts.placed,
      opts.extraWalkable,
      opts.roomId,
      opts.baseRemoved
    ) &&
    !(nRoom === HUB_ROOM_ID && isHubSpawnSafeZone(ex, ez)) &&
    !opts.playerOnTile(ex, ez);

  const frontOk =
    anchorOk &&
    floorWalkableTerrain(
      frontX,
      frontZ,
      opts.placed,
      opts.extraWalkable,
      opts.roomId,
      opts.baseRemoved
    ) &&
    !(nRoom === HUB_ROOM_ID && isHubSpawnSafeZone(frontX, frontZ)) &&
    !opts.playerOnTile(frontX, frontZ);

  return { exitOk, frontOk };
}

export function floorWalkableTerrainForMover(
  x: number,
  z: number,
  placed: ReadonlyMap<string, TerrainProps>,
  extraWalkable: ReadonlySet<string>,
  roomId: string,
  baseRemoved: ReadonlySet<string> | null | undefined,
  moverAddress: string | null,
  nowMs: number
): boolean {
  if (!isWalkableTile(x, z, extraWalkable, roomId, baseRemoved)) return false;
  const p = placed.get(tileKey(x, z)) ?? placed.get(blockKey(x, z, 0));
  if (!p) return true;
  if (p.passable || p.ramp) return true;
  if (isGatePassableForMover(p, moverAddress, nowMs, roomId)) return true;
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

/** Match server `canLeaveRampToFloorNeighbor` (see server `grid.ts`). */
function canLeaveRampToFloorNeighbor(
  rampX: number,
  rampZ: number,
  ramp: TerrainProps,
  nx: number,
  nz: number,
  pNeighbor: TerrainProps | undefined
): boolean {
  if (!ramp.ramp) return true;
  const [rdx, rdz] = RAMP_NEIGHBOR[ramp.rampDir & 3]!;
  const lowX = rampX - rdx;
  const lowZ = rampZ - rdz;
  if (nx === lowX && nz === lowZ) return true;
  if (pNeighbor?.ramp) {
    return canEnterRampFrom(rampX, rampZ, nx, nz, pNeighbor);
  }
  return false;
}

export function inferStartLayerClient(
  wx: number,
  wz: number,
  wy: number,
  placed: ReadonlyMap<string, TerrainProps>,
  moverCtx?: PathfindMoverContext | null,
  roomId?: string
): 0 | 1 {
  return inferTerrainStartLayer(
    wx,
    wz,
    wy,
    placed,
    moverCtx ?? undefined,
    roomId
  );
}

export function waypointWorldY(
  layer: 0 | 1,
  gx: number,
  gz: number,
  placed: ReadonlyMap<string, TerrainProps>
): number {
  if (layer === 0) return 0;
  const p = floorLevelTerrain(placed, gx, gz);
  if (!p || p.passable || p.ramp) return 0;
  return terrainObstacleHeight(p);
}

/**
 * Same rules as server `pathfindTerrain` (including ramp entry from low side only);
 * second coordinate is world Z (`FloorTile.y`). Floor layer uses cardinal steps only.
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
  baseRemoved?: ReadonlySet<string> | null,
  moverCtx?: PathfindMoverContext | null
): { x: number; z: number; layer: 0 | 1 }[] | null {
  const fw = (x: number, z: number): boolean =>
    moverCtx
      ? floorWalkableTerrainForMover(
          x,
          z,
          placed,
          extraWalkable,
          roomId,
          baseRemoved ?? null,
          moverCtx.address,
          moverCtx.nowMs
        )
      : floorWalkableTerrain(
          x,
          z,
          placed,
          extraWalkable,
          roomId,
          baseRemoved
        );

  const goalOk =
    goalLayer === 0
      ? fw(tx, tz)
      : level1SurfaceOpen(placed, tx, tz);
  if (!goalOk) {
    return null;
  }

  if (startLayer === 0) {
    if (!fw(sx, sz)) return null;
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
      const pCurFloor = floorLevelTerrain(placed, cur.x, cur.z);
      for (const [dx, dz] of DIRS4) {
        const nx = cur.x + dx;
        const nz = cur.z + dz;
        if (!isWalkableTile(nx, nz, extraWalkable, roomId, baseRemoved)) continue;
        const n0 = terrainNodeKey(nx, nz, 0);
        if (cameFrom.has(n0)) continue;
        if (!fw(nx, nz)) continue;
        const pTarget = floorLevelTerrain(placed, nx, nz);
        if (
          pCurFloor?.ramp &&
          !canLeaveRampToFloorNeighbor(
            cur.x,
            cur.z,
            pCurFloor,
            nx,
            nz,
            pTarget
          )
        ) {
          continue;
        }
        if (
          pTarget?.ramp &&
          !canEnterRampFrom(cur.x, cur.z, nx, nz, pTarget)
        ) {
          continue;
        }
        cameFrom.set(n0, ck);
        queue.push({ x: nx, z: nz, layer: 0 });
      }

      const pr = pCurFloor;
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
        if (fw(nx, nz) && rampFacesSolid(pN, nx, nz, cur.x, cur.z)) {
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
