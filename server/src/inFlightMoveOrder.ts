import {
  buildMoveOrderOutMsg,
  type MoveOrderOutMsg,
} from "./moveOrderBroadcast.js";
import type { ConnPathMoveState } from "./playerPathPose.js";

/**
 * Reconstruct the in-flight `moveOrder` from the walk session (`pathMove`),
 * not the remaining `pathQueue`. `serverNowMs` is send time so a late joiner
 * or duplicate plays mid-path instead of restarting at `startX`.
 */
export function buildInFlightMoveOrder(args: {
  address: string;
  pathMove: ConnPathMoveState | null | undefined;
  pathQueueLength: number;
  walkId: number;
  serverNowMs: number;
  speed?: number;
}): MoveOrderOutMsg | null {
  if (!args.pathMove || args.pathQueueLength <= 0) return null;
  if (args.pathMove.pathQueue.length === 0) return null;
  return buildMoveOrderOutMsg({
    address: args.address,
    pathQueue: args.pathMove.pathQueue,
    startX: args.pathMove.startPose.x,
    startZ: args.pathMove.startPose.z,
    startAtMs: args.pathMove.startAtMs,
    serverNowMs: args.serverNowMs,
    walkId: args.walkId,
    speed: args.speed,
  });
}

export function nextWalkId(prev: number | null | undefined): number {
  return (prev ?? 0) + 1;
}
