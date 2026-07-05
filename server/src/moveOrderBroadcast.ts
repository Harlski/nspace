import {
  DEFAULT_PATH_MOVE_SPEED,
  type PathWaypoint,
} from "./pathPosition.js";

/** Set `MOVE_ORDER_BROADCAST=1` to emit `moveOrder` on path walks (grid + pitch free-move). */
export const MOVE_ORDER_BROADCAST =
  process.env.MOVE_ORDER_BROADCAST === "1";

export type MoveOrderOutMsg = {
  type: "moveOrder";
  address: string;
  path: PathWaypoint[];
  startX: number;
  startZ: number;
  startAtMs: number;
  speed: number;
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
}): MoveOrderOutMsg {
  return {
    type: "moveOrder",
    address: args.address,
    path: args.pathQueue.map((w) => ({ ...w })),
    startX: args.startX,
    startZ: args.startZ,
    startAtMs: args.startAtMs,
    speed: args.speed ?? DEFAULT_PATH_MOVE_SPEED,
  };
}
