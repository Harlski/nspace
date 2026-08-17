import { MOVE_ORDER_BROADCAST } from "./moveOrderBroadcast.js";

/**
 * When move-order broadcast is on, path-walk rooms stop streaming pose snapshots in tick
 * `stateDelta` for walkers whose motion is fully described by an in-flight `moveOrder`.
 * World Cup field-like free-move keeps velocity snapshots.
 */
export const CUT_MOVEMENT_STREAM = MOVE_ORDER_BROADCAST;

/** Player fields compared for tick `state` / `stateDelta` diffs. */
export type TickPlayerSnapshot = {
  address: string;
  displayName: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  nimiqPay?: boolean;
  nimSendAway?: boolean;
  chatTyping?: boolean;
  challengeOpen?: boolean;
  worldcupCountry?: string | null;
  cosmeticAura?: string | null;
  cosmeticNameplate?: string | null;
  cosmeticChatBubble?: string | null;
  cosmeticTrail?: string | null;
};

const TICK_STATE_EQ_POS_EPS = 1e-5;
const TICK_STATE_EQ_VEL_EPS = 1e-8;

function nearTickCoord(a: number, b: number, eps: number): boolean {
  return Math.abs(a - b) <= eps;
}

export function tickPlayerMovementEqual(
  a: TickPlayerSnapshot,
  b: TickPlayerSnapshot
): boolean {
  return (
    nearTickCoord(a.x, b.x, TICK_STATE_EQ_POS_EPS) &&
    nearTickCoord(a.y, b.y, TICK_STATE_EQ_POS_EPS) &&
    nearTickCoord(a.z, b.z, TICK_STATE_EQ_POS_EPS) &&
    nearTickCoord(a.vx, b.vx, TICK_STATE_EQ_VEL_EPS) &&
    nearTickCoord(a.vz, b.vz, TICK_STATE_EQ_VEL_EPS)
  );
}

export function tickPlayerPresenceEqual(
  a: TickPlayerSnapshot,
  b: TickPlayerSnapshot
): boolean {
  return (
    a.displayName === b.displayName &&
    (a.nimiqPay ?? false) === (b.nimiqPay ?? false) &&
    (a.nimSendAway ?? false) === (b.nimSendAway ?? false) &&
    (a.chatTyping ?? false) === (b.chatTyping ?? false) &&
    (a.challengeOpen ?? false) === (b.challengeOpen ?? false) &&
    (a.worldcupCountry ?? null) === (b.worldcupCountry ?? null) &&
    (a.cosmeticAura ?? null) === (b.cosmeticAura ?? null) &&
    (a.cosmeticNameplate ?? null) === (b.cosmeticNameplate ?? null) &&
    (a.cosmeticChatBubble ?? null) === (b.cosmeticChatBubble ?? null) &&
    (a.cosmeticTrail ?? null) === (b.cosmeticTrail ?? null)
  );
}

export function cutMovementStreamEligible(args: {
  enabled: boolean;
  pathQueueLength: number;
  isFieldFreeMove: boolean;
}): boolean {
  return (
    args.enabled && args.pathQueueLength > 0 && !args.isFieldFreeMove
  );
}

export function shouldIncludeInTickStateDelta(args: {
  enabled: boolean;
  pathQueueLength: number;
  isFieldFreeMove: boolean;
  prev: TickPlayerSnapshot;
  next: TickPlayerSnapshot;
}): { include: boolean; suppressedMovementOnly: boolean } {
  const movementEqual = tickPlayerMovementEqual(args.prev, args.next);
  const presenceEqual = tickPlayerPresenceEqual(args.prev, args.next);

  if (movementEqual && presenceEqual) {
    return { include: false, suppressedMovementOnly: false };
  }

  if (
    cutMovementStreamEligible(args) &&
    !movementEqual &&
    presenceEqual
  ) {
    return { include: false, suppressedMovementOnly: true };
  }

  return { include: true, suppressedMovementOnly: false };
}

/** Presence events omit pose while Path Playback already owns the walk. */
export function shouldOmitPoseFromPresenceDelta(args: {
  enabled: boolean;
  pathQueueLength: number;
  isFieldFreeMove: boolean;
}): boolean {
  return cutMovementStreamEligible(args);
}

export type PresenceDeltaPlayer = Omit<
  TickPlayerSnapshot,
  "x" | "y" | "z" | "vx" | "vz"
> &
  Partial<Pick<TickPlayerSnapshot, "x" | "y" | "z" | "vx" | "vz">>;

export function playerStateForPresenceDelta(
  player: TickPlayerSnapshot,
  omitPose: boolean
): PresenceDeltaPlayer {
  const next: PresenceDeltaPlayer = { ...player };
  if (!omitPose) return next;
  delete next.x;
  delete next.y;
  delete next.z;
  delete next.vx;
  delete next.vz;
  return next;
}

/**
 * One-player (or few-player) presence payload. Never a full room roster.
 * Pose is stripped for CUT-eligible grid walkers so typing/pay/challenge cannot rewind Path Playback.
 */
export function presenceDeltaPlayers(args: {
  enabled: boolean;
  subjects: Array<{
    player: TickPlayerSnapshot;
    pathQueueLength: number;
    isFieldFreeMove: boolean;
  }>;
}): PresenceDeltaPlayer[] {
  return args.subjects.map((s) =>
    playerStateForPresenceDelta(
      s.player,
      shouldOmitPoseFromPresenceDelta({
        enabled: args.enabled,
        pathQueueLength: s.pathQueueLength,
        isFieldFreeMove: s.isFieldFreeMove,
      })
    )
  );
}
