export type RemoteMoveAbortWire = {
  address: string;
  x: number;
  z: number;
  y: number;
  vx: number;
  vz: number;
};

type PoseTarget = {
  set(x: number, y: number, z: number): void;
};

/** Drop remote path playback and snap to the authoritative pose from `moveAbort`. */
export function applyRemoteMoveAbort(args: {
  msg: RemoteMoveAbortWire;
  selfAddress: string;
  remoteMoveOrders: Map<string, unknown>;
  targetPos: PoseTarget | undefined;
  avatarGroup: { position: PoseTarget } | undefined;
}): void {
  if (args.msg.address === args.selfAddress) return;
  args.remoteMoveOrders.delete(args.msg.address);
  const py = Number.isFinite(args.msg.y) ? args.msg.y : 0;
  args.targetPos?.set(args.msg.x, py, args.msg.z);
  args.avatarGroup?.position.set(args.msg.x, py, args.msg.z);
}
