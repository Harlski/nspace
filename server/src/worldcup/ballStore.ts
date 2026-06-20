/**
 * World Cup soccer — per-room ball registry + persistence of player-placed balls.
 *
 * The field room's ball is config-defined and re-created at spawn on load (not
 * persisted). Player-placed balls (M3) persist their *definition* (spawn + creator) to
 * `server/data/worldcup-balls.json`; live positions reset to spawn on load.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { normalizeRoomId } from "../roomLayouts.js";
import {
  FIELD_BALL_SPAWN,
  FIELD_ROOM_ID,
  MAX_PLACED_BALLS_PER_ROOM,
} from "./config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "..", "data");
const BALLS_FILE = path.join(DATA_DIR, "worldcup-balls.json");

export interface Ball {
  id: string;
  roomId: string;
  x: number;
  z: number;
  vx: number;
  vz: number;
  /** Reset target (kickoff spot / placement tile). */
  spawnX: number;
  spawnZ: number;
  /** True for player-placed balls (persisted); false for the field's built-in ball. */
  placed: boolean;
  createdBy?: string;
  /** Last player to touch the ball, for goal attribution. */
  lastKickerAddress: string | null;
  lastKickAtMs: number;
  /**
   * Last *human* kicker (a Goalie touch never overwrites this), so a goal that deflects off
   * the keeper into the net still credits the attacker (see worldcup own-goal rule / ADR 0002).
   */
  lastRealKickerAddress: string | null;
  lastRealKickAtMs: number;
  /** While now < this, goals are ignored (ball is resetting). */
  goalCooldownUntilMs: number;
  /** Per-player kick cooldown timestamps (transient; not serialized). */
  lastKickByPlayer: Map<string, number>;
}

/** Wire shape sent to clients (no transient maps). */
export interface BallWire {
  id: string;
  x: number;
  z: number;
  vx: number;
  vz: number;
}

type PersistedPlacedBall = {
  id: string;
  roomId: string;
  spawnX: number;
  spawnZ: number;
  createdBy?: string;
};

type PersistedBalls = { balls: PersistedPlacedBall[] };

/** roomId (normalized) -> ballId -> Ball */
const roomBalls = new Map<string, Map<string, Ball>>();

function ensureDataDir(): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function newBall(partial: Omit<Ball, "lastKickByPlayer">): Ball {
  return { ...partial, lastKickByPlayer: new Map() };
}

function makeFieldBall(roomId: string): Ball {
  return newBall({
    id: "field",
    roomId,
    x: FIELD_BALL_SPAWN.x,
    z: FIELD_BALL_SPAWN.z,
    vx: 0,
    vz: 0,
    spawnX: FIELD_BALL_SPAWN.x,
    spawnZ: FIELD_BALL_SPAWN.z,
    placed: false,
    lastKickerAddress: null,
    lastKickAtMs: 0,
    lastRealKickerAddress: null,
    lastRealKickAtMs: 0,
    goalCooldownUntilMs: 0,
  });
}

function roomMap(roomId: string): Map<string, Ball> {
  const id = normalizeRoomId(roomId);
  let m = roomBalls.get(id);
  if (!m) {
    m = new Map();
    roomBalls.set(id, m);
  }
  // Lazily materialize the field's built-in ball.
  if (id === FIELD_ROOM_ID && !m.has("field")) {
    m.set("field", makeFieldBall(id));
  }
  return m;
}

/** All balls currently in a room (creates the field ball lazily for the field room). */
export function getBalls(roomId: string): Ball[] {
  return [...roomMap(roomId).values()];
}

/** True when a room currently has at least one ball (without materializing). */
export function roomHasBalls(roomId: string): boolean {
  const id = normalizeRoomId(roomId);
  if (id === FIELD_ROOM_ID) return true;
  const m = roomBalls.get(id);
  return !!m && m.size > 0;
}

export function ballToWire(b: Ball): BallWire {
  return {
    id: b.id,
    x: Math.round(b.x * 1000) / 1000,
    z: Math.round(b.z * 1000) / 1000,
    vx: Math.round(b.vx * 1000) / 1000,
    vz: Math.round(b.vz * 1000) / 1000,
  };
}

export function ballsToWire(roomId: string): BallWire[] {
  return getBalls(roomId).map(ballToWire);
}

/** Send the ball back to its spawn and clear motion + attribution. */
export function resetBall(ball: Ball): void {
  ball.x = ball.spawnX;
  ball.z = ball.spawnZ;
  ball.vx = 0;
  ball.vz = 0;
  ball.lastKickerAddress = null;
  ball.lastKickAtMs = 0;
  ball.lastRealKickerAddress = null;
  ball.lastRealKickAtMs = 0;
}

/**
 * worldcup: spawn the kickoff ball for an ephemeral Match Pitch. Uses the field ball shape
 * (id `"field"` so the Goalie's primary-ball lookup and reset behave like the pitch's) and
 * is never persisted. Replaces any existing ball in that room.
 */
export function spawnMatchBall(roomId: string): Ball {
  const id = normalizeRoomId(roomId);
  const m = roomMap(id);
  const ball = makeFieldBall(id);
  m.clear();
  m.set("field", ball);
  return ball;
}

/** worldcup: drop every ball in a room (Match Pitch teardown). Persisted balls untouched elsewhere. */
export function clearRoomBalls(roomId: string): void {
  roomBalls.delete(normalizeRoomId(roomId));
}

/** Add a player-placed ball (M3). Returns the ball or null if the room is at capacity. */
export function addPlacedBall(
  roomId: string,
  x: number,
  z: number,
  createdBy: string
): Ball | null {
  const m = roomMap(roomId);
  const placedCount = [...m.values()].filter((b) => b.placed).length;
  if (placedCount >= MAX_PLACED_BALLS_PER_ROOM) return null;
  const id = `b_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;
  const ball = newBall({
    id,
    roomId: normalizeRoomId(roomId),
    x,
    z,
    vx: 0,
    vz: 0,
    spawnX: x,
    spawnZ: z,
    placed: true,
    createdBy,
    lastKickerAddress: null,
    lastKickAtMs: 0,
    lastRealKickerAddress: null,
    lastRealKickAtMs: 0,
    goalCooldownUntilMs: 0,
  });
  m.set(id, ball);
  savePlacedBalls();
  return ball;
}

export function removeBall(roomId: string, ballId: string): boolean {
  const m = roomBalls.get(normalizeRoomId(roomId));
  if (!m) return false;
  const ball = m.get(ballId);
  if (!ball || !ball.placed) return false;
  m.delete(ballId);
  savePlacedBalls();
  return true;
}

export function loadBalls(): void {
  if (!fs.existsSync(BALLS_FILE)) return;
  try {
    const raw = JSON.parse(fs.readFileSync(BALLS_FILE, "utf8")) as PersistedBalls;
    for (const d of raw.balls ?? []) {
      const id = String(d.id ?? "").trim();
      const roomId = normalizeRoomId(String(d.roomId ?? "").trim());
      const spawnX = Number(d.spawnX);
      const spawnZ = Number(d.spawnZ);
      if (!id || !roomId || !Number.isFinite(spawnX) || !Number.isFinite(spawnZ)) {
        continue;
      }
      const m = roomMap(roomId);
      m.set(
        id,
        newBall({
          id,
          roomId,
          x: spawnX,
          z: spawnZ,
          vx: 0,
          vz: 0,
          spawnX,
          spawnZ,
          placed: true,
          createdBy: d.createdBy ? String(d.createdBy) : undefined,
          lastKickerAddress: null,
          lastKickAtMs: 0,
          lastRealKickerAddress: null,
          lastRealKickAtMs: 0,
          goalCooldownUntilMs: 0,
        })
      );
    }
    console.log(`[worldcup] Loaded placed balls from ${BALLS_FILE}`);
  } catch (err) {
    console.error("[worldcup] Failed to load balls:", err);
  }
}

export function savePlacedBalls(): void {
  try {
    ensureDataDir();
    const balls: PersistedPlacedBall[] = [];
    for (const [, m] of roomBalls) {
      for (const b of m.values()) {
        if (!b.placed) continue;
        balls.push({
          id: b.id,
          roomId: b.roomId,
          spawnX: b.spawnX,
          spawnZ: b.spawnZ,
          ...(b.createdBy ? { createdBy: b.createdBy } : {}),
        });
      }
    }
    const tmp = `${BALLS_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify({ balls } satisfies PersistedBalls), "utf8");
    fs.renameSync(tmp, BALLS_FILE);
  } catch (err) {
    console.error("[worldcup] Failed to save balls:", err);
  }
}
