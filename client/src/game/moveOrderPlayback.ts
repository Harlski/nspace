import {
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

export function moveOrderPlaybackActive(pathRemaining: number): boolean {
  return pathRemaining > 0;
}
