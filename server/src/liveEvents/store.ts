import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import type { LiveEventEnvelope, WorldEffect } from "./types.js";
import type {
  OperatorLiveEventMapping,
} from "./operatorMapping.js";
import type { LiveEventRoomTarget } from "./interactions.js";

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
    CREATE TABLE IF NOT EXISTS live_event_mappings (
      id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL UNIQUE,
      interaction_kind TEXT NOT NULL,
      room_target TEXT NOT NULL,
      room_id TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at_ms INTEGER NOT NULL,
      updated_at_ms INTEGER NOT NULL
    );
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

export function listSeenLiveEventTypes(): string[] {
  if (!db) return [];
  const rows = db
    .prepare(
      `SELECT type FROM accepted_live_events
       GROUP BY type
       ORDER BY MAX(accepted_at_ms) DESC, type ASC
       LIMIT 50`
    )
    .all() as Array<{ type: string }>;
  return rows.map((r) => r.type);
}

type MappingRow = {
  id: string;
  event_type: string;
  interaction_kind: string;
  room_target: string;
  room_id: string | null;
  enabled: number;
  created_at_ms: number;
  updated_at_ms: number;
};

function mappingFromRow(row: MappingRow): OperatorLiveEventMapping {
  return {
    id: row.id,
    eventType: row.event_type,
    interactionKind: row.interaction_kind,
    roomTarget: row.room_target as LiveEventRoomTarget,
    roomId: row.room_id,
    enabled: row.enabled === 1,
    createdAtMs: row.created_at_ms,
    updatedAtMs: row.updated_at_ms,
  };
}

export function listOperatorMappings(): OperatorLiveEventMapping[] {
  if (!db) return [];
  const rows = db
    .prepare(
      `SELECT id, event_type, interaction_kind, room_target, room_id,
              enabled, created_at_ms, updated_at_ms
       FROM live_event_mappings
       ORDER BY event_type ASC`
    )
    .all() as MappingRow[];
  return rows.map(mappingFromRow);
}

export function findEnabledOperatorMapping(
  eventType: string
): OperatorLiveEventMapping | null {
  if (!db) return null;
  const row = db
    .prepare(
      `SELECT id, event_type, interaction_kind, room_target, room_id,
              enabled, created_at_ms, updated_at_ms
       FROM live_event_mappings
       WHERE event_type = ? AND enabled = 1
       LIMIT 1`
    )
    .get(eventType) as MappingRow | undefined;
  return row ? mappingFromRow(row) : null;
}

export function getOperatorMapping(
  id: string
): OperatorLiveEventMapping | null {
  const row = requireDb()
    .prepare(
      `SELECT id, event_type, interaction_kind, room_target, room_id,
              enabled, created_at_ms, updated_at_ms
       FROM live_event_mappings WHERE id = ? LIMIT 1`
    )
    .get(id) as MappingRow | undefined;
  return row ? mappingFromRow(row) : null;
}

export type UpsertOperatorMappingResult =
  | { ok: true; mapping: OperatorLiveEventMapping }
  | { ok: false; error: "duplicate_event_type" | "not_found" };

export function insertOperatorMapping(
  mapping: OperatorLiveEventMapping
): UpsertOperatorMappingResult {
  const database = requireDb();
  try {
    database
      .prepare(
        `INSERT INTO live_event_mappings (
          id, event_type, interaction_kind, room_target, room_id,
          enabled, created_at_ms, updated_at_ms
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        mapping.id,
        mapping.eventType,
        mapping.interactionKind,
        mapping.roomTarget,
        mapping.roomId,
        mapping.enabled ? 1 : 0,
        mapping.createdAtMs,
        mapping.updatedAtMs
      );
    return { ok: true, mapping };
  } catch (err) {
    const code =
      err && typeof err === "object" && "code" in err
        ? String((err as { code?: unknown }).code)
        : "";
    if (
      code === "SQLITE_CONSTRAINT_UNIQUE" ||
      code === "SQLITE_CONSTRAINT_PRIMARYKEY" ||
      code === "SQLITE_CONSTRAINT"
    ) {
      return { ok: false, error: "duplicate_event_type" };
    }
    throw err;
  }
}

export function updateOperatorMapping(
  id: string,
  patch: Omit<OperatorLiveEventMapping, "id" | "createdAtMs">
): UpsertOperatorMappingResult {
  const existing = getOperatorMapping(id);
  if (!existing) return { ok: false, error: "not_found" };
  const database = requireDb();
  try {
    database
      .prepare(
        `UPDATE live_event_mappings SET
          event_type = ?, interaction_kind = ?, room_target = ?, room_id = ?,
          enabled = ?, updated_at_ms = ?
         WHERE id = ?`
      )
      .run(
        patch.eventType,
        patch.interactionKind,
        patch.roomTarget,
        patch.roomId,
        patch.enabled ? 1 : 0,
        patch.updatedAtMs,
        id
      );
    return {
      ok: true,
      mapping: {
        ...existing,
        ...patch,
        id,
      },
    };
  } catch (err) {
    const code =
      err && typeof err === "object" && "code" in err
        ? String((err as { code?: unknown }).code)
        : "";
    if (code === "SQLITE_CONSTRAINT_UNIQUE" || code === "SQLITE_CONSTRAINT") {
      return { ok: false, error: "duplicate_event_type" };
    }
    throw err;
  }
}

export function deleteOperatorMapping(id: string): boolean {
  const result = requireDb()
    .prepare(`DELETE FROM live_event_mappings WHERE id = ?`)
    .run(id);
  return result.changes > 0;
}
