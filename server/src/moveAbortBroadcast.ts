export type MoveAbortOutMsg = {
  type: "moveAbort";
  address: string;
  x: number;
  z: number;
  y: number;
  vx: number;
  vz: number;
};

export function shouldEmitMoveAbort(args: {
  enabled: boolean;
  hadPathQueue: boolean;
  poseCorrection?: boolean;
}): boolean {
  if (!args.enabled) return false;
  return args.hadPathQueue || args.poseCorrection === true;
}

export function buildMoveAbortOutMsg(args: {
  address: string;
  x: number;
  z: number;
  y: number;
  vx: number;
  vz: number;
}): MoveAbortOutMsg {
  return {
    type: "moveAbort",
    address: args.address,
    x: args.x,
    z: args.z,
    y: args.y,
    vx: args.vx,
    vz: args.vz,
  };
}

export function buildMoveAbortFromPlayer(args: {
  address: string;
  player: { x: number; y: number; z: number; vx?: number; vz?: number };
}): MoveAbortOutMsg {
  return buildMoveAbortOutMsg({
    address: args.address,
    x: args.player.x,
    z: args.player.z,
    y: args.player.y,
    vx: args.player.vx ?? 0,
    vz: args.player.vz ?? 0,
  });
}
