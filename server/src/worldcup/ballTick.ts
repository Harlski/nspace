/**
 * World Cup soccer — per-room ball simulation step, called from the authoritative
 * room tick. Owns its own broadcast-throttle state so the hook in `rooms.ts` stays a
 * single call. No client "kick" intent exists: kicks are derived from player positions
 * the server already has.
 */
import type { RoomBounds } from "../roomLayouts.js";
import {
  applyKick,
  canKick,
  detectGoal,
  kickFromPlayer,
  stepBall,
  type SolidTilePredicate,
} from "./ballPhysics.js";
import { ballToWire, getBalls, resetBall, type Ball, type BallWire } from "./ballStore.js";
import {
  BALL_KICK,
  BALL_PHYSICS,
  BALL_STATE_BROADCAST_MIN_MS,
  GOAL_DEPTH,
  GOAL_RESET_COOLDOWN_MS,
  isGoalieAddress,
  LAST_KICKER_WINDOW_MS,
  type GoalZone,
} from "./config.js";
import type { CircleCollider } from "./ballPhysics.js";

export interface TickPlayer {
  x: number;
  z: number;
  vx: number;
  vz: number;
  address: string;
  /** Optional override for this kicker's reach (defaults to BALL_KICK.reach). */
  kickReach?: number;
}

export interface TickRoomBallsArgs {
  roomId: string;
  bounds: RoomBounds;
  players: TickPlayer[];
  now: number;
  dt: number;
  /** Solid-tile predicate for obstacle bounce (non-field rooms with blocks). */
  isSolidTile?: SolidTilePredicate;
  /** Field-only: goal zones to score against. */
  goals?: readonly GoalZone[];
  /** Field-only: called when the ball enters a goal (scorer may be null if uncredited). */
  onGoal?: (ball: Ball, goalId: GoalZone["id"], scorerAddress: string | null) => void;
  /** Blocker-mode Goalies: circular obstacles the ball reflects off. */
  colliders?: readonly CircleCollider[];
  broadcastBallState: (balls: BallWire[]) => void;
}

const EPS = 1e-6;
const lastBroadcastAt = new Map<string, number>();

export function forgetRoomBallBroadcast(roomId: string): void {
  lastBroadcastAt.delete(roomId);
}

export function tickRoomBalls(args: TickRoomBallsArgs): void {
  const { roomId, bounds, players, now, dt, isSolidTile, goals, onGoal, colliders } =
    args;
  const balls = getBalls(roomId);
  if (balls.length === 0) return;

  let dirty = false;
  let forceBroadcast = false;

  for (const ball of balls) {
    // Proximity kick from any nearby moving player (per-player cooldown).
    for (const p of players) {
      if (
        !canKick(
          p.x,
          p.z,
          ball.x,
          ball.z,
          BALL_PHYSICS.radius,
          p.kickReach ?? BALL_KICK.reach
        )
      ) {
        continue;
      }
      const last = ball.lastKickByPlayer.get(p.address) ?? 0;
      if (now - last < BALL_KICK.cooldownMs) continue;
      const { dirX, dirZ, speed } = kickFromPlayer(
        { px: p.x, pz: p.z, vx: p.vx, vz: p.vz, bx: ball.x, bz: ball.z },
        BALL_KICK,
        BALL_PHYSICS.maxSpeed
      );
      const kicked = applyKick(ball, dirX, dirZ, speed, BALL_PHYSICS);
      ball.vx = kicked.vx;
      ball.vz = kicked.vz;
      ball.lastKickByPlayer.set(p.address, now);
      ball.lastKickerAddress = p.address;
      ball.lastKickAtMs = now;
      // A Goalie touch (kicker-mode pseudo-player) must never become the credited kicker:
      // track the last *human* kicker separately so a deflection/own-goal off the keeper
      // still credits the attacker (worldcup own-goal rule).
      if (!isGoalieAddress(p.address)) {
        ball.lastRealKickerAddress = p.address;
        ball.lastRealKickAtMs = now;
      }
      dirty = true;
    }

    const speedBefore = Math.hypot(ball.vx, ball.vz);
    const next = stepBall(
      ball,
      dt,
      bounds,
      BALL_PHYSICS,
      isSolidTile,
      goals,
      goals ? GOAL_DEPTH : 0,
      colliders
    );
    ball.x = next.x;
    ball.z = next.z;
    ball.vx = next.vx;
    ball.vz = next.vz;

    const speedAfter = Math.hypot(ball.vx, ball.vz);
    if (speedAfter > EPS) dirty = true;
    else if (speedBefore > EPS) forceBroadcast = true; // ensure final rest position

    // Goal detection (field room only).
    if (goals && onGoal && now >= ball.goalCooldownUntilMs) {
      const goalId = detectGoal(ball, goals);
      if (goalId) {
        // Credit the last *human* kicker (never a Goalie), so a goal that deflects off the
        // keeper into the net still credits the attacker. A goal with no recent human touch
        // (e.g. the keeper alone knocked it in) credits nobody.
        const credited =
          ball.lastRealKickerAddress &&
          now - ball.lastRealKickAtMs <= LAST_KICKER_WINDOW_MS
            ? ball.lastRealKickerAddress
            : null;
        onGoal(ball, goalId, credited);
        ball.goalCooldownUntilMs = now + GOAL_RESET_COOLDOWN_MS;
        resetBall(ball);
        forceBroadcast = true;
      }
    }
  }

  const last = lastBroadcastAt.get(roomId) ?? 0;
  const due = now - last >= BALL_STATE_BROADCAST_MIN_MS;
  if (forceBroadcast || (dirty && due)) {
    args.broadcastBallState(balls.map(ballToWire));
    lastBroadcastAt.set(roomId, now);
  }
}
