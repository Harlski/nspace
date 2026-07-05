import {
  DEFAULT_PATH_MOVE_SPEED,
  DEFAULT_PATH_TICK_MS,
  poseAlongPathAtTime,
  type PathMoveBounds,
  type PathMovePose,
  type PathTileCrossing,
  type PathWaypoint,
  type WaypointYFn,
} from "./pathPosition.js";
import { MOVE_ORDER_BROADCAST } from "./moveOrderBroadcast.js";

/**
 * Analytic path pose for gameplay authority while move-order rollout is active.
 *
 * Consumed from `rooms.ts` via `playerPoseNow`, range/adjacency helpers, and
 * optional tick skip ({@link ANALYTIC_PATH_SKIP_STEPPING}).
 *
 * Call sites: World Cup ball kicks, teleporter tile, gate auto-walk, block claims,
 * build/mine/floor range checks. Tile-walked achievements and canvas claims use
 * tick `arrivedTiles` (stepped or analytic when skip-stepping is on).
 *
 * Still stepped: NPC fake players, worldcup pitch free-move.
 */

/** Active path session: immutable start state for analytic pose at `nowMs`. */
export type ConnPathMoveState = {
  startAtMs: number;
  startPose: PathMovePose;
  /** Waypoints at path start (matches conn.pathQueue when the walk began). */
  pathQueue: PathWaypoint[];
  /** Count of {@link PathTileCrossing} already emitted to achievements / canvas. */
  tilesEmitted: number;
};

/**
 * When on, grid path walkers skip per-tick `advanceAlongPathHuman` and rely on analytic pose
 * (requires {@link ConnPathMoveState} on active walks). Rollout ties to move-order broadcast.
 */
export const ANALYTIC_PATH_SKIP_STEPPING =
  process.env.ANALYTIC_PATH_SKIP_STEPPING === "1" || MOVE_ORDER_BROADCAST;

export function snapshotPathMoveBegin(args: {
  player: { x: number; y: number; z: number; vx: number; vz: number };
  pathQueue: PathWaypoint[];
  startAtMs: number;
}): ConnPathMoveState | null {
  if (args.pathQueue.length === 0) return null;
  return {
    startAtMs: args.startAtMs,
    startPose: {
      x: args.player.x,
      y: args.player.y,
      z: args.player.z,
      vx: args.player.vx,
      vz: args.player.vz,
    },
    pathQueue: args.pathQueue.map((w) => ({ ...w })),
    tilesEmitted: 0,
  };
}

export function resolveConnPathMoveAt(args: {
  state: ConnPathMoveState;
  nowMs: number;
  bounds: PathMoveBounds;
  waypointY: WaypointYFn;
  speed?: number;
  tickMs?: number;
}): {
  pose: PathMovePose;
  pathQueue: PathWaypoint[];
  arrivedTiles: PathTileCrossing[];
} {
  return poseAlongPathAtTime({
    startPose: args.state.startPose,
    pathQueue: args.state.pathQueue,
    startAtMs: args.state.startAtMs,
    nowMs: args.nowMs,
    bounds: args.bounds,
    waypointY: args.waypointY,
    speed: args.speed ?? DEFAULT_PATH_MOVE_SPEED,
    tickMs: args.tickMs ?? DEFAULT_PATH_TICK_MS,
  });
}

/** Pose at `nowMs` for gameplay authority (ball kick, range checks, teleporter tile, …). */
export function gameplayPoseFromConn(args: {
  player: { x: number; y: number; z: number; vx: number; vz: number };
  pathQueue: PathWaypoint[];
  pathMove: ConnPathMoveState | null | undefined;
  nowMs: number;
  bounds: PathMoveBounds;
  waypointY: WaypointYFn;
}): PathMovePose {
  if (!args.pathMove || args.pathQueue.length === 0) {
    return {
      x: args.player.x,
      y: args.player.y,
      z: args.player.z,
      vx: args.player.vx,
      vz: args.player.vz,
    };
  }
  return resolveConnPathMoveAt({
    state: args.pathMove,
    nowMs: args.nowMs,
    bounds: args.bounds,
    waypointY: args.waypointY,
  }).pose;
}

/**
 * Apply analytic path pose to live player state; returns tile crossings not yet emitted.
 * Used when {@link ANALYTIC_PATH_SKIP_STEPPING} replaces stepped simulation.
 */
export function tickAnalyticPathHuman(args: {
  player: PathMovePose;
  pathQueue: PathWaypoint[];
  pathMove: ConnPathMoveState;
  nowMs: number;
  bounds: PathMoveBounds;
  waypointY: WaypointYFn;
}): {
  changed: boolean;
  arrivedTiles: PathTileCrossing[];
  newArrivedTiles: PathTileCrossing[];
} {
  const resolved = resolveConnPathMoveAt({
    state: args.pathMove,
    nowMs: args.nowMs,
    bounds: args.bounds,
    waypointY: args.waypointY,
  });
  const prevX = args.player.x;
  const prevZ = args.player.z;
  args.player.x = resolved.pose.x;
  args.player.y = resolved.pose.y;
  args.player.z = resolved.pose.z;
  args.player.vx = resolved.pose.vx;
  args.player.vz = resolved.pose.vz;
  args.pathQueue.length = 0;
  args.pathQueue.push(...resolved.pathQueue);
  const newArrivedTiles = resolved.arrivedTiles.slice(args.pathMove.tilesEmitted);
  args.pathMove.tilesEmitted = resolved.arrivedTiles.length;
  if (args.pathQueue.length === 0) {
    args.pathMove.tilesEmitted = 0;
  }
  const changed =
    Math.abs(prevX - args.player.x) > 1e-9 ||
    Math.abs(prevZ - args.player.z) > 1e-9 ||
    args.player.vx !== 0 ||
    args.player.vz !== 0 ||
    newArrivedTiles.length > 0;
  return {
    changed,
    arrivedTiles: resolved.arrivedTiles,
    newArrivedTiles,
  };
}
