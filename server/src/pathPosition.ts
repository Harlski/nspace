import { snapToTile } from "./grid.js";

/** One terrain path waypoint (matches server pathQueue entries). */
export type PathWaypoint = { x: number; z: number; layer: 0 | 1 };

export type PathMoveBounds = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

export type PathMovePose = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
};

export type PathTileCrossing = { x: number; z: number };

/** Matches {@link rooms.ts} ARRIVE_EPS for human path followers. */
export const PATH_ARRIVE_EPS = 0.04;

/** Matches {@link rooms.ts} MOVE_SPEED. */
export const DEFAULT_PATH_MOVE_SPEED = 5;

/** Matches {@link rooms.ts} TICK_MS. */
export const DEFAULT_PATH_TICK_MS = 50;

export type WaypointYFn = (layer: 0 | 1, gx: number, gz: number) => number;

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/**
 * One simulation step along a human path — same rules as `advanceAlongPathHuman` in rooms.ts.
 * Mutates `pose` and `pathQueue`.
 */
export function stepHumanAlongPath(args: {
  pose: PathMovePose;
  pathQueue: PathWaypoint[];
  dt: number;
  speed: number;
  bounds: PathMoveBounds;
  waypointY: WaypointYFn;
  arriveEps?: number;
}): { changed: boolean; arrivedTiles: PathTileCrossing[] } {
  const arriveEps = args.arriveEps ?? PATH_ARRIVE_EPS;
  let changedThis = false;
  const arrivedTiles: PathTileCrossing[] = [];
  const { pose, pathQueue, dt, speed, bounds, waypointY } = args;

  while (true) {
    if (pathQueue.length === 0) {
      pose.vx = 0;
      pose.vz = 0;
      break;
    }
    const goal = pathQueue[0]!;
    const gy = waypointY(goal.layer, goal.x, goal.z);
    const dx = goal.x - pose.x;
    const dy = gy - pose.y;
    const dz = goal.z - pose.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist < arriveEps) {
      const prevTile = snapToTile(pose.x, pose.z);
      pose.x = goal.x;
      pose.z = goal.z;
      pose.y = gy;
      pose.vx = 0;
      pose.vz = 0;
      pathQueue.shift();
      changedThis = true;
      const newTile = snapToTile(pose.x, pose.z);
      if (prevTile.x !== newTile.x || prevTile.z !== newTile.z) {
        arrivedTiles.push({ x: newTile.x, z: newTile.z });
      }
      continue;
    }
    const step = speed * dt;
    const t = Math.min(1, step / dist);
    const prevTile = snapToTile(pose.x, pose.z);
    pose.x = clamp(pose.x + dx * t, bounds.minX, bounds.maxX);
    pose.y = pose.y + dy * t;
    pose.z = clamp(pose.z + dz * t, bounds.minZ, bounds.maxZ);
    pose.vx = (dx / dist) * speed;
    pose.vz = (dz / dist) * speed;
    changedThis = true;
    const newTile = snapToTile(pose.x, pose.z);
    if (prevTile.x !== newTile.x || prevTile.z !== newTile.z) {
      arrivedTiles.push({ x: newTile.x, z: newTile.z });
    }
    break;
  }

  return { changed: changedThis, arrivedTiles };
}

/**
 * Pose and tile crossings at `nowMs` from `startAtMs`, stepping in `tickMs` slices (same cadence
 * as the room tick loop).
 */
export function poseAlongPathAtTime(args: {
  startPose: PathMovePose;
  pathQueue: PathWaypoint[];
  startAtMs: number;
  nowMs: number;
  bounds: PathMoveBounds;
  waypointY: WaypointYFn;
  speed?: number;
  tickMs?: number;
  arriveEps?: number;
}): {
  pose: PathMovePose;
  pathQueue: PathWaypoint[];
  arrivedTiles: PathTileCrossing[];
} {
  const elapsed = Math.max(0, args.nowMs - args.startAtMs);
  const pose: PathMovePose = { ...args.startPose };
  const pathQueue = args.pathQueue.map((w) => ({ ...w }));
  const arrivedTiles: PathTileCrossing[] = [];

  if (elapsed === 0) {
    return { pose, pathQueue, arrivedTiles };
  }

  const tickMs = args.tickMs ?? DEFAULT_PATH_TICK_MS;
  const speed = args.speed ?? DEFAULT_PATH_MOVE_SPEED;
  let remaining = elapsed;

  while (remaining > 0) {
    const stepMs = Math.min(remaining, tickMs);
    const result = stepHumanAlongPath({
      pose,
      pathQueue,
      dt: stepMs / 1000,
      speed,
      bounds: args.bounds,
      waypointY: args.waypointY,
      arriveEps: args.arriveEps,
    });
    arrivedTiles.push(...result.arrivedTiles);
    remaining -= stepMs;
  }

  return { pose, pathQueue, arrivedTiles };
}
