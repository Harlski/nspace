import {
  PATH_ARRIVE_EPS,
  poseAlongPathAtTime,
  type PathMoveBounds,
  type PathMovePose,
  type PathWaypoint,
} from "./pathPosition.js";
import { waypointWorldY, type TerrainProps } from "./grid.js";

export type MoveOrderWire = {
  address: string;
  path: PathWaypoint[];
  startX: number;
  startZ: number;
  startAtMs: number;
  speed: number;
  serverNowMs?: number;
  walkId?: number;
};

export type PlaybackPose = { x: number; z: number };

export type PoseHeartbeatPlayerWire = {
  address: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  walkId: number;
  walking: boolean;
  serverNowMs: number;
};

export type PlaybackHold = {
  pose: PlaybackPose;
  path: PathWaypoint[];
  startX: number;
  startZ: number;
  walkId?: number;
};

export function remotePoseFromMoveOrder(args: {
  order: MoveOrderWire;
  startY: number;
  nowMs: number;
  bounds: PathMoveBounds;
  placed: ReadonlyMap<string, TerrainProps>;
}): { pose: PathMovePose; pathRemaining: number } {
  const result = poseAlongPathAtTime({
    startPose: {
      x: args.order.startX,
      y: args.startY,
      z: args.order.startZ,
      vx: 0,
      vz: 0,
    },
    pathQueue: args.order.path.map((w) => ({ ...w })),
    startAtMs: args.order.startAtMs,
    nowMs: args.nowMs,
    bounds: args.bounds,
    waypointY: (layer, gx, gz) => waypointWorldY(layer, gx, gz, args.placed),
    speed: args.order.speed,
  });
  return {
    pose: result.pose,
    pathRemaining: result.pathQueue.length,
  };
}

export function moveOrderPlaybackActive(args: {
  pathRemaining: number;
  pose: PlaybackPose;
  path: PathWaypoint[];
}): boolean {
  if (args.pathRemaining > 0) return true;
  const finalWp = args.path[args.path.length - 1];
  if (!finalWp) return false;
  return (
    Math.hypot(args.pose.x - finalWp.x, args.pose.z - finalWp.z) >
    PATH_ARRIVE_EPS
  );
}

/** True when Path Playback has reached the walk destination and the order can drop. */
export function moveOrderPlaybackFinished(args: {
  pathRemaining: number;
  pose: PlaybackPose;
  path: PathWaypoint[];
  /** Optional click goal tile; when set, drain requires reaching it too. */
  clickGoal?: { x: number; z: number } | null;
}): boolean {
  if (moveOrderPlaybackActive(args)) return false;
  if (args.clickGoal) {
    return (
      Math.hypot(
        args.pose.x - args.clickGoal.x,
        args.pose.z - args.clickGoal.z
      ) <= PATH_ARRIVE_EPS
    );
  }
  return true;
}

/** Map a local sample onto server time using the last stamped `serverNowMs`. */
export function playbackNowMs(args: {
  localNowMs: number;
  serverNowMs?: number;
  recvLocalMs?: number;
}): number {
  if (
    args.serverNowMs == null ||
    !Number.isFinite(args.serverNowMs) ||
    args.recvLocalMs == null ||
    !Number.isFinite(args.recvLocalMs)
  ) {
    return args.localNowMs;
  }
  return args.localNowMs + (args.serverNowMs - args.recvLocalMs);
}

export function remainingAlongPath(
  from: PlaybackPose,
  path: PathWaypoint[]
): number {
  if (path.length === 0) return 0;
  // Prefix waypoints may already be consumed; do not backtrack through them.
  let best = Infinity;
  for (let startIdx = 0; startIdx < path.length; startIdx++) {
    let len = 0;
    let cx = from.x;
    let cz = from.z;
    const first = path[startIdx]!;
    len += Math.hypot(first.x - cx, first.z - cz);
    cx = first.x;
    cz = first.z;
    for (let i = startIdx + 1; i < path.length; i++) {
      const w = path[i]!;
      len += Math.hypot(w.x - cx, w.z - cz);
      cx = w.x;
      cz = w.z;
    }
    best = Math.min(best, len);
  }
  return best;
}

export function poseIsBehindAlongPath(
  last: PlaybackPose,
  candidate: PlaybackPose,
  path: PathWaypoint[],
  eps = PATH_ARRIVE_EPS
): boolean {
  return remainingAlongPath(candidate, path) > remainingAlongPath(last, path) + eps;
}

export function shouldAdoptSnapshotPose(args: {
  playbackActive: boolean;
  behind: boolean;
  intentionalSnap: boolean;
  walkIdChanged?: boolean;
  walkingFlag?: boolean;
}): boolean {
  if (args.intentionalSnap) return true;
  if (args.walkingFlag === false) return true;
  if (args.walkIdChanged) return true;
  if (args.playbackActive) return false;
  if (args.behind) return false;
  return true;
}

export type PlaybackWalkIdentity = Pick<
  MoveOrderWire,
  "path" | "startX" | "startZ" | "walkId"
>;

export function walkIdIncreased(
  lastWalkId: number | undefined,
  nextWalkId: number | undefined
): boolean {
  if (nextWalkId == null || lastWalkId == null) return false;
  return nextWalkId > lastWalkId;
}

/** Same walk session (redirect/reissue), not a new click-to-walk. */
export function playbackSameWalk(
  last: PlaybackHold | null | undefined,
  order: PlaybackWalkIdentity
): boolean {
  if (!last) return false;
  if (last.walkId != null && order.walkId != null) {
    return last.walkId === order.walkId;
  }
  if (last.startX !== order.startX || last.startZ !== order.startZ) return false;
  if (last.path.length !== order.path.length) return false;
  for (let i = 0; i < last.path.length; i++) {
    const a = last.path[i]!;
    const b = order.path[i]!;
    if (a.x !== b.x || a.z !== b.z || a.layer !== b.layer) return false;
  }
  return true;
}

export function shouldAdvancePlaybackSample(args: {
  last: PlaybackHold | null | undefined;
  candidatePose: PlaybackPose;
  order: PlaybackWalkIdentity;
}): boolean {
  if (!args.last) return true;
  if (!playbackSameWalk(args.last, args.order)) return true;
  return !poseIsBehindAlongPath(
    args.last.pose,
    args.candidatePose,
    args.order.path
  );
}

export function shouldAdoptReplacementMoveOrder(args: {
  last: PlaybackHold | null | undefined;
  candidatePose: PlaybackPose;
  order: PlaybackWalkIdentity;
}): boolean {
  if (!args.last) return true;
  if (walkIdIncreased(args.last.walkId, args.order.walkId)) return true;
  return !poseIsBehindAlongPath(
    args.last.pose,
    args.candidatePose,
    args.last.path
  );
}
