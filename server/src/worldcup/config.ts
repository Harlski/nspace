/**
 * World Cup soccer feature — server config (FEATURE-FLAGGED, DEPRECATABLE).
 *
 * Everything for the seasonal soccer kickaround lives under `server/src/worldcup/`
 * and `client/src/worldcup/`. To deprecate after the tournament: set
 * `WORLDCUP_ENABLED=0`, then later delete these folders + the few `worldcup`-tagged
 * hook lines in `rooms.ts` / `index.ts` (grep "worldcup"). The scores JSON is kept
 * as an archive.
 */
import type { RoomBounds } from "../roomLayouts.js";

function envFlag(name: string, defaultOn: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === null || raw.trim() === "") return defaultOn;
  const v = raw.trim().toLowerCase();
  return !(v === "0" || v === "false" || v === "off" || v === "no");
}

/** Parse a finite, non-negative integer env var, falling back to `dflt`. */
function envInt(name: string, dflt: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === null || raw.trim() === "") return dflt;
  const n = Math.floor(Number(raw.trim()));
  return Number.isFinite(n) && n >= 0 ? n : dflt;
}

/** Parse a finite, non-negative float env var, falling back to `dflt`. */
function envFloat(name: string, dflt: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === null || raw.trim() === "") return dflt;
  const n = Number(raw.trim());
  return Number.isFinite(n) && n >= 0 ? n : dflt;
}

/** Master switch. On by default (seasonal); set WORLDCUP_ENABLED=0 to disable. */
export const WORLDCUP_ENABLED = envFlag("WORLDCUP_ENABLED", true);

/** Standalone soccer field room id. */
export const FIELD_ROOM_ID = "field";

/** Soccer pitch: 21 wide (x) x 15 deep (z), centered on origin. */
export const FIELD_BOUNDS: RoomBounds = {
  minX: -10,
  maxX: 10,
  minZ: -7,
  maxZ: 7,
};

/** Field ball kickoff spot (room center). */
export const FIELD_BALL_SPAWN = { x: 0, z: 0 } as const;

/**
 * How far (world units) a player may step past the pitch edges so they can get fully behind a
 * ball pinned against a wall, rather than bouncing it off. Only player movement is widened;
 * the ball's collision walls stay at the true `FIELD_BOUNDS ± 0.5` (see `ballPhysics`).
 */
export const FIELD_OUTFIELD_MARGIN = envFloat("WORLDCUP_FIELD_OUTFIELD_MARGIN", 1.0);

/** Hub door tile (west edge) that leads to the field; spawn tile inside the field. */
export const HUB_FIELD_DOOR = {
  x: -12,
  z: 6,
  targetRoomId: FIELD_ROOM_ID,
  spawnX: -8,
  spawnZ: 6,
} as const;

/** Field door tile (west edge) back to the hub. */
export const FIELD_HUB_DOOR = {
  x: -10,
  z: 6,
  targetRoomId: "hub",
  spawnX: -11,
  spawnZ: 6,
} as const;

/**
 * Goals are defined by their end-line band. The goal LINE sits at the pitch end
 * (`west`: `minX - 0.5`; `east`: `maxX + 0.5`) and the mouth spans `minZ-0.5 .. maxZ+0.5`
 * between the posts. A goal counts only once the ball center crosses that line within the
 * mouth — not merely entering the band in front of it (see `detectGoal`). The end-line wall
 * has an opening at the mouth so the ball can pass through into the net box.
 */
export type GoalZone = {
  id: "west" | "east";
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

export const FIELD_GOALS: GoalZone[] = [
  { id: "west", minX: -10, maxX: -9, minZ: -2, maxZ: 2 },
  { id: "east", minX: 9, maxX: 10, minZ: -2, maxZ: 2 },
];

/** Depth of the net box behind each goal line (world units; matches the client net depth). */
export const GOAL_DEPTH = 1.2;

/** Ground-only 2D ball physics tuning (world units; 1 unit = 1 tile). */
export const BALL_PHYSICS = {
  /** Ball collision radius. */
  radius: 0.45,
  /** Hard cap on speed (units/sec). Above player MOVE_SPEED (5) so kicks feel lively. */
  maxSpeed: 12,
  /** Linear rolling deceleration (units/sec^2). */
  decel: 7,
  /** Below this speed the ball is treated as stopped. */
  minSpeed: 0.05,
  /** Wall/obstacle bounce energy retention (0..1). */
  restitution: 0.6,
} as const;

/** Kicking tuning. */
export const BALL_KICK = {
  /** Player center within (radius + this) of the ball can kick it. */
  reach: 0.6,
  /** Minimum launch speed on contact even from a slow nudge. */
  baseSpeed: 5.5,
  /** Extra launch speed scaled by the player's current speed. */
  playerSpeedScale: 1.6,
  /** Per-player-per-ball cooldown between kicks (ms). */
  cooldownMs: 220,
} as const;

/** After a goal, ignore further goals on that ball while it resets (ms). */
export const GOAL_RESET_COOLDOWN_MS = 1500;

/** A goal credits the last kicker only if they touched it within this window (ms). */
export const LAST_KICKER_WINDOW_MS = 12_000;

/** Min interval between `ballState` broadcasts per room (ms). */
export const BALL_STATE_BROADCAST_MIN_MS = 90;

/** Max player-placed balls per room (the field's built-in ball is separate). */
export const MAX_PLACED_BALLS_PER_ROOM = 3;

// ---------------------------------------------------------------------------
// Goalies (PRD: World Cup — 1v1 Matches, Goalies, Spectating & Goal Rewards)
// ---------------------------------------------------------------------------

/**
 * Goalie behaviour model. `kicker` injects the goalie into the proximity-kick path so it
 * clears the ball like a player; `blocker` makes it a physical collider in `stepBall`.
 * A/B selectable so we can keep whichever feels best and delete the other.
 */
export type GoalieMode = "kicker" | "blocker";
export const WORLDCUP_GOALIE_MODE: GoalieMode =
  (process.env.WORLDCUP_GOALIE_MODE?.trim().toLowerCase() === "blocker"
    ? "blocker"
    : "kicker");

/**
 * Sentinel "wallet" used as a Goalie's last-kicker id so a goal that merely deflects off
 * the keeper credits nobody (cannot be farmed for stats or rewards). Never a real address
 * (real Nimiq addresses are `NQ…`).
 */
export const GOALIE_SENTINEL_ADDRESS = "__worldcup_goalie__";

/**
 * Goalie tuning (world units; 1 unit = 1 tile). All env-tunable for the feel-test.
 *
 * Defaults are deliberately beatable: the keeper is slower than a player, reacts with a lag,
 * patrols only the inner part of the mouth (leaving a corner gap on each side), and in
 * kicker mode clears the ball only within a short reach. A well-placed corner shot scores;
 * a tame shot down the middle is saved.
 */
export const GOALIE = {
  /** Lateral tracking speed along the goal line (units/sec). Below player MOVE_SPEED (5). */
  moveSpeed: envFloat("WORLDCUP_GOALIE_MOVE_SPEED", 2.5),
  /** Collision radius of the keeper (tenths of a tile via env). */
  radius: envInt("WORLDCUP_GOALIE_REACH_TENTHS", 5) / 10,
  /** Reaction lag: time constant (ms) the keeper takes to lock onto the ball's z. */
  reactionMs: envInt("WORLDCUP_GOALIE_REACTION_MS", 260),
  /**
   * Fraction (0..1, via percent env) of the radius-inset mouth the keeper patrols, centred
   * on the mouth. Below 100 it leaves a permanent corner gap on each side. Default 60%.
   */
  coverage: envInt("WORLDCUP_GOALIE_COVERAGE_PCT", 60) / 100,
  /**
   * Kicker-mode only: how close (tenths of a tile, beyond the ball radius) the ball must be
   * for the keeper to clear it. Shorter than the player reach (0.6) so even a central save
   * needs decent keeper positioning. Default 0.3.
   */
  kickReach: envInt("WORLDCUP_GOALIE_KICK_REACH_TENTHS", 3) / 10,
} as const;

/** True when the ball's credited last-kicker must be ignored (goalie deflection). */
export function isGoalieAddress(address: string | null | undefined): boolean {
  return address === GOALIE_SENTINEL_ADDRESS;
}

// ---------------------------------------------------------------------------
// 1v1 Matches
// ---------------------------------------------------------------------------

export const MATCH = {
  /** Handshake + "Match starting in 3…2…1" countdown before both players are teleported in (ms). */
  countdownMs: envInt("WORLDCUP_MATCH_COUNTDOWN_MS", 3_000),
  /** Regulation length (ms). */
  durationMs: envInt("WORLDCUP_MATCH_DURATION_MS", 180_000),
  /** Golden Goal sudden-death cap (ms) after a tied regulation; then a Draw. */
  goldenGoalCapMs: envInt("WORLDCUP_MATCH_GOLDEN_GOAL_CAP_MS", 90_000),
  /** Soft cap on Spectators per Match Pitch. */
  spectatorCap: envInt("WORLDCUP_MATCH_SPECTATOR_CAP", 20),
  /** Auto-clear a Challenge that no one accepts within this window (ms). */
  challengeTimeoutMs: envInt("WORLDCUP_CHALLENGE_TIMEOUT_MS", 60_000),
  /** How long the end-of-match result lingers before entrants are returned (ms). */
  resultLingerMs: envInt("WORLDCUP_MATCH_RESULT_LINGER_MS", 5_000),
  /**
   * After a goal (that doesn't end the Match) both players are reset to their kickoff spots and
   * frozen for this long while a "Kickoff in 3…2…1" countdown plays; the Match clock pauses too.
   */
  goalResetMs: envInt("WORLDCUP_MATCH_GOAL_RESET_MS", 5_000),
} as const;

/**
 * Ephemeral 1v1 Match Pitch room-id prefix. A pitch is created on demand when a Challenge
 * is accepted, reuses the Free Play Field bounds/goals/ball physics, and is torn down when
 * the Match ends (never persisted; see ADR 0001). Only the server moves players in.
 */
export const MATCH_PITCH_PREFIX = "wc-match-";

export function makeMatchPitchRoomId(id: string): string {
  return `${MATCH_PITCH_PREFIX}${id}`;
}

export function isMatchPitchRoomId(roomId: string | null | undefined): boolean {
  return typeof roomId === "string" && roomId.startsWith(MATCH_PITCH_PREFIX);
}

// ---------------------------------------------------------------------------
// Goal rewards (Free Play Field only; see ADR 0002 — unlimited caps by default)
// ---------------------------------------------------------------------------

/** Luna in 1 NIM (1 NIM = 100000 luna). Mirrors the payout sender's LUNA_PER_NIM. */
const LUNA_PER_NIM = 100_000n;

export const GOAL_REWARD = {
  /** Minimum payout per Paid Goal (luna). Default 50000 = 0.5 NIM. */
  minRewardLuna: BigInt(envInt("WORLDCUP_GOAL_REWARD_MIN_LUNA", 50_000)),
  /** Maximum payout per Paid Goal (luna). Default 200000 = 2 NIM. */
  maxRewardLuna: BigInt(envInt("WORLDCUP_GOAL_REWARD_MAX_LUNA", 200_000)),
  /** Per-wallet Paid Goals per UTC day; 0 = unlimited (emergency cap when set). */
  dailyCapPerWallet: envInt("WORLDCUP_GOAL_REWARD_DAILY_CAP_PER_WALLET", 0),
  /** Global goal-reward budget per UTC day (luna); 0 = unlimited (emergency cap when set). */
  dailyBudgetLuna:
    BigInt(envInt("WORLDCUP_GOAL_REWARD_DAILY_BUDGET_NIM", 0)) * LUNA_PER_NIM,
  /** Distinct players for full-rate payout; fewer → Solo Goal (half rate). */
  minPlayers: envInt("WORLDCUP_GOAL_REWARD_MIN_PLAYERS", 2),
} as const;
