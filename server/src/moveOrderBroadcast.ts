import {
  DEFAULT_PATH_MOVE_SPEED,
  type PathWaypoint,
} from "./pathPosition.js";

/**
 * Path Playback dual-send: on by default. Set `MOVE_ORDER_BROADCAST=0` to revert to
 * snapshot pose streaming for active path walkers (kill switch).
 */
export function isMoveOrderBroadcastEnabled(
  envValue: string | undefined = process.env.MOVE_ORDER_BROADCAST
): boolean {
  return envValue !== "0";
}

export const MOVE_ORDER_BROADCAST = isMoveOrderBroadcastEnabled();

export type MoveOrderOutMsg = {
  type: "moveOrder";
  address: string;
  path: PathWaypoint[];
  startX: number;
  startZ: number;
  startAtMs: number;
  speed: number;
  serverNowMs: number;
};

export function shouldEmitMoveOrder(args: {
  enabled: boolean;
  pathQueueLength: number;
}): boolean {
  return args.enabled && args.pathQueueLength > 0;
}

export function buildMoveOrderOutMsg(args: {
  address: string;
  pathQueue: PathWaypoint[];
  startX: number;
  startZ: number;
  startAtMs: number;
  speed?: number;
  serverNowMs?: number;
}): MoveOrderOutMsg {
  return {
    type: "moveOrder",
    address: args.address,
    path: args.pathQueue.map((w) => ({ ...w })),
    startX: args.startX,
    startZ: args.startZ,
    startAtMs: args.startAtMs,
    speed: args.speed ?? DEFAULT_PATH_MOVE_SPEED,
    serverNowMs: args.serverNowMs ?? args.startAtMs,
  };
}
