import {
  DEFAULT_PATH_MOVE_SPEED,
  type PathWaypoint,
} from "./pathPosition.js";

/** Minimum gap between Click Markers for the same mover (joystick spam). */
export const MOVEMENT_WATCH_CLICK_MIN_INTERVAL_MS = 120;

export type MovementWatchRejectReason =
  | "rate_limited"
  | "no_path"
  | "mine"
  | "mine_empty";

export const MOVEMENT_WATCH_CLIENT_INTENT_REASONS: ReadonlySet<MovementWatchRejectReason> =
  new Set(["no_path", "mine", "mine_empty"]);

export type MovementWatchActiveOutMsg = {
  type: "movementWatchActive";
  active: boolean;
};

export type MovementWatchWalkWire = {
  address: string;
  displayName: string;
  goalX: number;
  goalZ: number;
  goalLayer: 0 | 1;
  path: PathWaypoint[];
  startX: number;
  startZ: number;
  startAtMs: number;
  speed: number;
};

export type MovementWatchSnapshotOutMsg = {
  type: "movementWatchSnapshot";
  walks: MovementWatchWalkWire[];
};

export type MovementWatchClickOutMsg = {
  type: "movementWatchClick";
  address: string;
  displayName: string;
  x: number;
  z: number;
  layer: 0 | 1;
  accepted: boolean;
  /** When true, client should drop a lingering Click Marker. */
  showMarker: boolean;
  reason?: MovementWatchRejectReason;
  path?: PathWaypoint[];
  startX?: number;
  startZ?: number;
  startAtMs?: number;
  speed?: number;
};

export type MovementWatchClearOutMsg = {
  type: "movementWatchClear";
  address: string;
};

export type MovementWatchOutMsg =
  | MovementWatchSnapshotOutMsg
  | MovementWatchClickOutMsg
  | MovementWatchClearOutMsg
  | MovementWatchActiveOutMsg;

export type MovementWatchClickThrottleState = {
  lastMarkerKey: string | null;
  lastMarkerAtMs: number;
};

export function canSubscribeMovementWatch(isAdminWallet: boolean): boolean {
  return isAdminWallet;
}

export function movementWatchDestKey(
  x: number,
  z: number,
  layer: 0 | 1,
  kind: "accept" | MovementWatchRejectReason
): string {
  const tx = Math.round(x);
  const tz = Math.round(z);
  return `${kind}:${tx},${tz},${layer}`;
}

/**
 * Whether to drop a Click Marker for this intent. Path updates may still be sent
 * when this returns false (accepted re-path to the same tile).
 */
export function shouldShowMovementWatchMarker(args: {
  throttle: MovementWatchClickThrottleState;
  destKey: string;
  nowMs: number;
  minIntervalMs?: number;
}): boolean {
  const minInterval =
    args.minIntervalMs ?? MOVEMENT_WATCH_CLICK_MIN_INTERVAL_MS;
  if (args.throttle.lastMarkerKey !== args.destKey) return true;
  return args.nowMs - args.throttle.lastMarkerAtMs >= minInterval;
}

export function noteMovementWatchMarkerShown(
  throttle: MovementWatchClickThrottleState,
  destKey: string,
  nowMs: number
): void {
  throttle.lastMarkerKey = destKey;
  throttle.lastMarkerAtMs = nowMs;
}

export function buildMovementWatchSnapshot(args: {
  walks: MovementWatchWalkWire[];
}): MovementWatchSnapshotOutMsg {
  return {
    type: "movementWatchSnapshot",
    walks: args.walks.map((w) => ({
      ...w,
      path: w.path.map((p) => ({ ...p })),
    })),
  };
}

export function buildMovementWatchWalkFromConn(args: {
  address: string;
  displayName: string;
  player: { x: number; z: number };
  pathQueue: PathWaypoint[];
  pathMoveStartAtMs: number | null;
  nowMs: number;
  speed?: number;
}): MovementWatchWalkWire | null {
  if (args.pathQueue.length === 0) return null;
  const goal = args.pathQueue[args.pathQueue.length - 1]!;
  return {
    address: args.address,
    displayName: args.displayName,
    goalX: goal.x,
    goalZ: goal.z,
    goalLayer: goal.layer ?? 0,
    path: args.pathQueue.map((p) => ({ ...p })),
    startX: args.player.x,
    startZ: args.player.z,
    startAtMs: args.pathMoveStartAtMs ?? args.nowMs,
    speed: args.speed ?? DEFAULT_PATH_MOVE_SPEED,
  };
}

export function buildMovementWatchAcceptedClick(args: {
  address: string;
  displayName: string;
  x: number;
  z: number;
  layer: 0 | 1;
  showMarker: boolean;
  pathQueue: PathWaypoint[];
  startX: number;
  startZ: number;
  startAtMs: number;
  speed?: number;
}): MovementWatchClickOutMsg {
  return {
    type: "movementWatchClick",
    address: args.address,
    displayName: args.displayName,
    x: args.x,
    z: args.z,
    layer: args.layer,
    accepted: true,
    showMarker: args.showMarker,
    path: args.pathQueue.map((p) => ({ ...p })),
    startX: args.startX,
    startZ: args.startZ,
    startAtMs: args.startAtMs,
    speed: args.speed ?? DEFAULT_PATH_MOVE_SPEED,
  };
}

export function buildMovementWatchRejectedClick(args: {
  address: string;
  displayName: string;
  x: number;
  z: number;
  layer: 0 | 1;
  reason: MovementWatchRejectReason;
  showMarker: boolean;
}): MovementWatchClickOutMsg {
  return {
    type: "movementWatchClick",
    address: args.address,
    displayName: args.displayName,
    x: args.x,
    z: args.z,
    layer: args.layer,
    accepted: false,
    showMarker: args.showMarker,
    reason: args.reason,
  };
}

export function buildMovementWatchClear(address: string): MovementWatchClearOutMsg {
  return { type: "movementWatchClear", address };
}

export function buildMovementWatchActive(active: boolean): MovementWatchActiveOutMsg {
  return { type: "movementWatchActive", active };
}

export function parseMovementWatchClientIntentReason(
  raw: unknown
): MovementWatchRejectReason | null {
  if (typeof raw !== "string") return null;
  if (!MOVEMENT_WATCH_CLIENT_INTENT_REASONS.has(raw as MovementWatchRejectReason)) {
    return null;
  }
  return raw as MovementWatchRejectReason;
}

export function countMovementWatchSubscribers<
  T extends { movementWatch?: boolean },
>(conns: Iterable<T>): number {
  let n = 0;
  for (const c of conns) {
    if (c.movementWatch) n += 1;
  }
  return n;
}

/** Recipients: subscribed admins in the room (caller supplies the filtered list). */
export function filterMovementWatchRecipients<T extends { movementWatch?: boolean }>(
  conns: Iterable<T>
): T[] {
  const out: T[] = [];
  for (const c of conns) {
    if (c.movementWatch) out.push(c);
  }
  return out;
}
