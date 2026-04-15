import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");
const MAZE_RECORDS_FILE = path.join(DATA_DIR, "maze-records.json");

export type MazeRecord = {
  address: string;
  bestMs: number;
  updatedAt: number;
};

type PersistedMazeRecords = {
  records: MazeRecord[];
};

const records = new Map<string, MazeRecord>();

function ensureDataDir(): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export function loadMazeRecords(): void {
  if (!fs.existsSync(MAZE_RECORDS_FILE)) return;
  try {
    const raw = JSON.parse(
      fs.readFileSync(MAZE_RECORDS_FILE, "utf8")
    ) as PersistedMazeRecords;
    records.clear();
    for (const r of raw.records ?? []) {
      const address = String(r.address ?? "").trim();
      const bestMs = Number(r.bestMs);
      const updatedAt = Number(r.updatedAt);
      if (!address || !Number.isFinite(bestMs) || bestMs <= 0) continue;
      records.set(address, {
        address,
        bestMs,
        updatedAt: Number.isFinite(updatedAt) ? updatedAt : Date.now(),
      });
    }
    console.log(`[maze-records] Loaded ${records.size} records`);
  } catch (err) {
    console.error("[maze-records] Failed to load:", err);
  }
}

function saveMazeRecords(): void {
  try {
    ensureDataDir();
    const payload: PersistedMazeRecords = {
      records: [...records.values()].sort((a, b) => a.bestMs - b.bestMs),
    };
    const tmp = `${MAZE_RECORDS_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(payload), "utf8");
    fs.renameSync(tmp, MAZE_RECORDS_FILE);
  } catch (err) {
    console.error("[maze-records] Failed to save:", err);
  }
}

export function recordMazeCompletion(address: string, elapsedMs: number): {
  improved: boolean;
  record: MazeRecord;
} {
  const key = String(address).trim();
  const ms = Math.max(1, Math.floor(Number(elapsedMs)));
  const now = Date.now();
  const prev = records.get(key);
  if (!prev || ms < prev.bestMs) {
    const next: MazeRecord = { address: key, bestMs: ms, updatedAt: now };
    records.set(key, next);
    saveMazeRecords();
    return { improved: true, record: next };
  }
  return { improved: false, record: prev };
}

export function getTopMazeRecords(limit: number): MazeRecord[] {
  const n = Math.max(1, Math.floor(Number(limit) || 10));
  return [...records.values()]
    .sort((a, b) => a.bestMs - b.bestMs)
    .slice(0, n)
    .map((r) => ({ ...r }));
}
