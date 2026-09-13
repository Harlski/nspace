import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import type { LiveEventEnvelope, WorldEffect } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "..", "data");

function liveEventStorePath(): string {
  const override = process.env.LIVE_EVENT_STORE_FILE?.trim();
  return override && override.length > 0
    ? path.resolve(override)
    : path.join(DATA_DIR, "live-events.sqlite");
}

let db: Database.Database | null = null;

function requireDb(): Database.Database {
  if (!db) throw new Error("live event store not initialized");
  return db;
}

export function initLiveEventStore(): void {
  if (db) return;
  const sqlitePath = liveEventStorePath();
  fs.mkdirSync(path.dirname(path.resolve(sqlitePath)), { recursive: true });
  db = new Database(sqlitePath);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS accepted_live_events (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      occurred_at TEXT NOT NULL,
      source TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      accepted_at_ms INTEGER NOT NULL,
      effect_kind TEXT,
      effect_until_ms INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_accepted_live_events_effect_until
      ON accepted_live_events (effect_kind, effect_until_ms);
  `);
}

export function _resetLiveEventStoreForTests(): void {
  if (db) {
    db.close();
    db = null;
  }
}

export type PersistLiveEventResult =
  | { duplicate: false }
  | { duplicate: true };

/**
 * Persist an accepted Live Event Id. Unique `id` is the idempotency key.
 * Duplicates do not update the row (retries must not restack World Effects).
 */
export function persistAcceptedLiveEvent(
  envelope: LiveEventEnvelope,
  effect: WorldEffect | null,
  acceptedAtMs: number
): PersistLiveEventResult {
  const database = requireDb();
  try {
    database
      .prepare(
        `INSERT INTO accepted_live_events (
          id, type, occurred_at, source, payload_json, accepted_at_ms,
          effect_kind, effect_until_ms
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        envelope.id,
        envelope.type,
        envelope.occurredAt,
        envelope.source,
        JSON.stringify(envelope.payload),
        acceptedAtMs,
        effect?.kind ?? null,
        effect?.untilMs ?? null
      );
    return { duplicate: false };
  } catch (err) {
    const code =
      err && typeof err === "object" && "code" in err
        ? String((err as { code?: unknown }).code)
        : "";
    if (code === "SQLITE_CONSTRAINT_PRIMARYKEY" || code === "SQLITE_CONSTRAINT") {
      return { duplicate: true };
    }
    throw err;
  }
}

/** Latest Live Boost end time still in the future, if any. */
export function latestLiveBoostUntilMs(nowMs: number): number | null {
  if (!db) return null;
  const row = db
    .prepare(
      `SELECT MAX(effect_until_ms) AS until_ms
       FROM accepted_live_events
       WHERE effect_kind = 'live_boost' AND effect_until_ms > ?`
    )
    .get(nowMs) as { until_ms: number | null } | undefined;
  const until = row?.until_ms;
  return typeof until === "number" && Number.isFinite(until) ? until : null;
}

export function hasAcceptedLiveEventId(id: string): boolean {
  const row = requireDb()
    .prepare(`SELECT 1 AS ok FROM accepted_live_events WHERE id = ? LIMIT 1`)
    .get(id) as { ok: number } | undefined;
  return Boolean(row);
}
