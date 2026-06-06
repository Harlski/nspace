import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const STORE_FILE = process.env.PLAYER_LAST_SESSION_STORE_FILE
  ? path.resolve(process.env.PLAYER_LAST_SESSION_STORE_FILE)
  : path.join(__dirname, "..", "data", "player-last-sessions.json");

/** Reconnect within this window restores last room + tile (see `resolveResumeLogin`). */
export const PLAYER_RECONNECT_GRACE_MS = 10 * 60 * 1000;

export type PlayerLastSession = {
  roomId: string;
  x: number;
  z: number;
  y?: number;
  disconnectedAt: number;
};

type StoreFile = { sessions: Record<string, PlayerLastSession> };

function ensureDir(): void {
  const dir = path.dirname(STORE_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readStore(): StoreFile {
  if (!fs.existsSync(STORE_FILE)) return { sessions: {} };
  try {
    const raw = fs.readFileSync(STORE_FILE, "utf8");
    const j = JSON.parse(raw) as unknown;
    if (j && typeof j === "object" && "sessions" in (j as StoreFile)) {
      const sessions = (j as StoreFile).sessions;
      if (sessions && typeof sessions === "object") return { sessions };
    }
  } catch {
    /* fall through */
  }
  return { sessions: {} };
}

function writeStore(data: StoreFile): void {
  ensureDir();
  const tmp = `${STORE_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 0), "utf8");
  fs.renameSync(tmp, STORE_FILE);
}

export function flushPlayerLastSessionSync(): void {
  /* writes are synchronous on set */
}

export function getPlayerLastSession(
  normalizedAddress: string
): PlayerLastSession | null {
  const key = normalizedAddress.trim().toUpperCase();
  if (!key) return null;
  const row = readStore().sessions[key];
  if (!row || typeof row !== "object") return null;
  const roomId = String(row.roomId ?? "").trim();
  const x = Number(row.x);
  const z = Number(row.z);
  const disconnectedAt = Number(row.disconnectedAt);
  if (!roomId || !Number.isFinite(x) || !Number.isFinite(z)) return null;
  if (!Number.isFinite(disconnectedAt) || disconnectedAt <= 0) return null;
  const y =
    typeof row.y === "number" && Number.isFinite(row.y) ? row.y : undefined;
  return {
    roomId,
    x,
    z,
    ...(y !== undefined ? { y } : {}),
    disconnectedAt,
  };
}

export function setPlayerLastSession(
  normalizedAddress: string,
  session: {
    roomId: string;
    x: number;
    z: number;
    y?: number;
    disconnectedAt?: number;
  }
): void {
  const key = normalizedAddress.trim().toUpperCase();
  if (!key) return;
  const roomId = String(session.roomId ?? "").trim();
  const x = Number(session.x);
  const z = Number(session.z);
  if (!roomId || !Number.isFinite(x) || !Number.isFinite(z)) return;
  const y =
    typeof session.y === "number" && Number.isFinite(session.y)
      ? session.y
      : undefined;
  const data = readStore();
  data.sessions[key] = {
    roomId,
    x,
    z,
    ...(y !== undefined ? { y } : {}),
    disconnectedAt: session.disconnectedAt ?? Date.now(),
  };
  writeStore(data);
}
