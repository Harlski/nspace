import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const LOG_DIR = process.env.EVENT_LOG_DIR
  ? path.resolve(process.env.EVENT_LOG_DIR)
  : path.join(__dirname, "..", "data", "events");

export type EventRecord = {
  ts: number;
  kind: string;
  sessionId: string;
  address: string;
  roomId: string;
  durationMs?: number;
  payload?: Record<string, unknown>;
};

export type SessionSummary = {
  sessionId: string;
  address: string;
  roomId: string;
  startedAt: number;
  endedAt: number | null;
};

function ensureLogDir(): void {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

function todayFile(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return path.join(LOG_DIR, `events-${y}-${m}-${day}.jsonl`);
}

function appendRecord(rec: EventRecord): void {
  ensureLogDir();
  const line = `${JSON.stringify(rec)}\n`;
  fs.appendFileSync(todayFile(), line, "utf8");
}

export function beginSession(address: string, roomId: string): {
  sessionId: string;
  startedAt: number;
} {
  const sessionId = crypto.randomBytes(12).toString("hex");
  const startedAt = Date.now();
  appendRecord({
    ts: startedAt,
    kind: "session_start",
    sessionId,
    address,
    roomId,
  });
  return { sessionId, startedAt };
}

export function endSession(
  sessionId: string,
  address: string,
  roomId: string,
  startedAt: number
): void {
  const ts = Date.now();
  appendRecord({
    ts,
    kind: "session_end",
    sessionId,
    address,
    roomId,
    durationMs: ts - startedAt,
  });
}

export function logGameplayEvent(
  sessionId: string,
  address: string,
  roomId: string,
  kind: string,
  payload: Record<string, unknown>
): void {
  appendRecord({
    ts: Date.now(),
    kind,
    sessionId,
    address,
    roomId,
    payload,
  });
}

function listEventFiles(maxDays: number): string[] {
  if (!fs.existsSync(LOG_DIR)) return [];
  const files = fs
    .readdirSync(LOG_DIR)
    .filter((f) => f.startsWith("events-") && f.endsWith(".jsonl"));
  files.sort();
  return files.slice(-Math.max(1, maxDays)).map((f) => path.join(LOG_DIR, f));
}

function parseLines(filePath: string): EventRecord[] {
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, "utf8");
  const out: EventRecord[] = [];
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    try {
      out.push(JSON.parse(t) as EventRecord);
    } catch {
      /* skip corrupt */
    }
  }
  return out;
}

/** Unique addresses seen in session_start within recent files. */
export function listRecentPlayerAddresses(
  maxDays: number,
  limit: number
): string[] {
  const files = listEventFiles(maxDays);
  const seen = new Set<string>();
  for (const fp of files) {
    for (const rec of parseLines(fp)) {
      if (rec.kind === "session_start" && rec.address) seen.add(rec.address);
    }
  }
  return [...seen].sort().slice(0, limit);
}

export function listSessionsForPlayer(
  address: string,
  maxDays: number
): SessionSummary[] {
  const files = listEventFiles(maxDays);
  const byId = new Map<
    string,
    { roomId: string; startedAt: number; endedAt: number | null }
  >();

  for (const fp of files) {
    for (const rec of parseLines(fp)) {
      if (rec.address !== address) continue;
      if (rec.kind === "session_start") {
        byId.set(rec.sessionId, {
          roomId: rec.roomId,
          startedAt: rec.ts,
          endedAt: null,
        });
      } else if (rec.kind === "session_end") {
        const cur = byId.get(rec.sessionId);
        if (cur) cur.endedAt = rec.ts;
        else {
          byId.set(rec.sessionId, {
            roomId: rec.roomId,
            startedAt: rec.ts - (rec.durationMs ?? 0),
            endedAt: rec.ts,
          });
        }
      }
    }
  }

  const out: SessionSummary[] = [];
  for (const [sessionId, v] of byId) {
    out.push({
      sessionId,
      address,
      roomId: v.roomId,
      startedAt: v.startedAt,
      endedAt: v.endedAt,
    });
  }
  out.sort((a, b) => b.startedAt - a.startedAt);
  return out;
}

export function getEventsForSession(sessionId: string, maxDays: number): EventRecord[] {
  const files = listEventFiles(maxDays);
  const out: EventRecord[] = [];
  for (const fp of files) {
    for (const rec of parseLines(fp)) {
      if (rec.sessionId === sessionId) out.push(rec);
    }
  }
  out.sort((a, b) => a.ts - b.ts);
  return out;
}

/** No-op for sync-per-line writer; hook for future buffering. */
export function flushEventLogSync(): void {
  /* sync append — nothing to flush */
}
