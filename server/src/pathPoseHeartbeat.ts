/**
 * Low-rate analytic pose for click-to-walk Path Playback. Not a tick pose stream.
 * Subject to client never-rewind; `walking=false` is an implicit abort.
 */

export const PATH_POSE_HEARTBEAT_MS = 1000;
export const PATH_POSE_HEARTBEAT_AFTER_DRAIN_MS = 1000;

export type PoseHeartbeatPlayer = {
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

export type PoseHeartbeatOutMsg = {
  type: "poseHeartbeat";
  players: PoseHeartbeatPlayer[];
};

export function heartbeatDue(args: {
  nowMs: number;
  lastHeartbeatAtMs: number | null | undefined;
  intervalMs?: number;
}): boolean {
  const interval = args.intervalMs ?? PATH_POSE_HEARTBEAT_MS;
  if (args.lastHeartbeatAtMs == null) return true;
  return args.nowMs - args.lastHeartbeatAtMs >= interval;
}

/**
 * Include walkers and recently drained humans. Field-like free-move keeps tick
 * velocity snapshots instead.
 */
export function heartbeatWalkingState(args: {
  pathQueueLength: number;
  pathDrainedAtMs: number | null | undefined;
  nowMs: number;
  isFieldFreeMove: boolean;
  afterDrainMs?: number;
}): { include: boolean; walking: boolean } {
  if (args.isFieldFreeMove) return { include: false, walking: false };
  if (args.pathQueueLength > 0) return { include: true, walking: true };
  const until = args.afterDrainMs ?? PATH_POSE_HEARTBEAT_AFTER_DRAIN_MS;
  if (
    args.pathDrainedAtMs != null &&
    args.nowMs - args.pathDrainedAtMs <= until
  ) {
    return { include: true, walking: false };
  }
  return { include: false, walking: false };
}

export function buildPoseHeartbeatOutMsg(
  players: PoseHeartbeatPlayer[]
): PoseHeartbeatOutMsg | null {
  if (players.length === 0) return null;
  return { type: "poseHeartbeat", players };
}

export function buildPoseHeartbeatPlayer(args: {
  address: string;
  pose: { x: number; y: number; z: number; vx: number; vz: number };
  walkId: number;
  walking: boolean;
  serverNowMs: number;
}): PoseHeartbeatPlayer {
  return {
    address: args.address,
    x: args.pose.x,
    y: args.pose.y,
    z: args.pose.z,
    vx: args.pose.vx,
    vz: args.pose.vz,
    walkId: args.walkId,
    walking: args.walking,
    serverNowMs: args.serverNowMs,
  };
}
