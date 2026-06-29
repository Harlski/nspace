import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import { initCampaignStore, getCampaignDatabase, _resetCampaignStoreForTests } from "./campaignStore.js";
import {
  clampDeployParam,
  getCosmeticPreset,
  isPassiveSlot,
  listCosmeticPresets,
  resolveDeployRules,
  type CosmeticSlot,
  type DeployDefaults,
  type PassiveSlot,
} from "./cosmeticPresets.js";

export type CatalogStatus = "draft" | "published" | "archived";
export type ChangelogAction =
  | "created"
  | "updated"
  | "published"
  | "archived"
  | "granted";
export type EntitlementSource = "purchase" | "grant" | "achievement";

export type CatalogEntryPublic = {
  cosmeticSku: string;
  presetId: string;
  slot: CosmeticSlot;
  status: CatalogStatus;
  displayName: string;
  description: string;
  collection: string;
  sortOrder: number;
  priceLuna: string;
  cooldownSec: number | null;
  durationSec: number | null;
  roomCap: number | null;
  deployRange: number | null;
  createdAt: string;
  updatedAt: string;
};

export type ChangelogRowPublic = {
  id: string;
  cosmeticSku: string;
  at: string;
  actorWallet: string;
  action: ChangelogAction;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
};

export type EntitlementPublic = {
  cosmeticSku: string;
  grantedAt: string;
  source: EntitlementSource;
  intentId: string | null;
  txHash: string | null;
};

export type LoadoutPublic = {
  auraSku: string | null;
  nameplateSku: string | null;
  chatBubbleSku: string | null;
  trailSku: string | null;
};

type CatalogRow = {
  cosmetic_sku: string;
  preset_id: string;
  status: CatalogStatus;
  display_name: string;
  description: string;
  collection: string;
  sort_order: number;
  price_luna: string;
  cooldown_sec: number | null;
  duration_sec: number | null;
  room_cap: number | null;
  deploy_range: number | null;
  created_at_ms: number;
  updated_at_ms: number;
};

function normalizeWallet(v: string): string {
  return String(v || "").replace(/\s+/g, "").toUpperCase();
}

function normalizeSku(v: string): string {
  return String(v ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

let cosmeticTablesReady = false;

const COSMETICS_V2_HARD_RESET_KEY = "cosmetics_v2_hard_reset_v1";

function requireDb(): Database.Database {
  initCosmeticStore();
  return getCampaignDatabase();
}

function ensureCosmeticMetaTable(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS cosmetic_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

/** One-time v2 hard reset: wipe player cosmetic data and v1 catalog rows. Idempotent. */
export function runCosmeticsV2HardResetIfNeeded(): void {
  initCampaignStore();
  const database = getCampaignDatabase();
  ensureCosmeticMetaTable(database);
  const done = database
    .prepare(`SELECT 1 FROM cosmetic_meta WHERE key = ?`)
    .get(COSMETICS_V2_HARD_RESET_KEY);
  if (done) return;

  const countEntitlements = (
    database.prepare(`SELECT COUNT(*) AS c FROM cosmetic_entitlements`).get() as {
      c: number;
    }
  ).c;
  const countLoadouts = (
    database.prepare(`SELECT COUNT(*) AS c FROM cosmetic_loadouts`).get() as {
      c: number;
    }
  ).c;
  const countCatalog = (
    database.prepare(`SELECT COUNT(*) AS c FROM cosmetic_catalog`).get() as {
      c: number;
    }
  ).c;
  const countChangelog = (
    database.prepare(`SELECT COUNT(*) AS c FROM cosmetic_changelog`).get() as {
      c: number;
    }
  ).c;

  database.exec(`
    DELETE FROM cosmetic_entitlements;
    DELETE FROM cosmetic_loadouts;
    DELETE FROM cosmetic_catalog;
    DELETE FROM cosmetic_changelog;
  `);

  const marker = {
    at: new Date().toISOString(),
    cleared: {
      entitlements: countEntitlements,
      loadouts: countLoadouts,
      catalog: countCatalog,
      changelog: countChangelog,
    },
  };
  database
    .prepare(`INSERT INTO cosmetic_meta (key, value) VALUES (?, ?)`)
    .run(COSMETICS_V2_HARD_RESET_KEY, JSON.stringify(marker));

  console.log(
    "[cosmetic-store] cosmetics v2 hard reset applied",
    JSON.stringify(marker)
  );
}

export function initCosmeticStore(): void {
  initCampaignStore();
  const database = getCampaignDatabase();
  if (!cosmeticTablesReady) {
    database.exec(`
    CREATE TABLE IF NOT EXISTS cosmetic_catalog (
      cosmetic_sku TEXT PRIMARY KEY,
      preset_id TEXT NOT NULL,
      status TEXT NOT NULL,
      display_name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      collection TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      price_luna TEXT NOT NULL,
      cooldown_sec INTEGER,
      duration_sec INTEGER,
      room_cap INTEGER,
      deploy_range INTEGER,
      created_at_ms INTEGER NOT NULL,
      updated_at_ms INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS ix_cosmetic_catalog_status
      ON cosmetic_catalog(status);
    CREATE INDEX IF NOT EXISTS ix_cosmetic_catalog_collection
      ON cosmetic_catalog(collection);

    CREATE TABLE IF NOT EXISTS cosmetic_changelog (
      id TEXT PRIMARY KEY,
      cosmetic_sku TEXT NOT NULL,
      at_ms INTEGER NOT NULL,
      actor_wallet TEXT NOT NULL,
      action TEXT NOT NULL,
      before_json TEXT,
      after_json TEXT
    );
    CREATE INDEX IF NOT EXISTS ix_cosmetic_changelog_sku
      ON cosmetic_changelog(cosmetic_sku, at_ms DESC);

    CREATE TABLE IF NOT EXISTS cosmetic_entitlements (
      wallet TEXT NOT NULL,
      cosmetic_sku TEXT NOT NULL,
      granted_at_ms INTEGER NOT NULL,
      source TEXT NOT NULL,
      intent_id TEXT,
      tx_hash TEXT,
      PRIMARY KEY (wallet, cosmetic_sku)
    );
    CREATE INDEX IF NOT EXISTS ix_cosmetic_entitlements_wallet
      ON cosmetic_entitlements(wallet);

    CREATE TABLE IF NOT EXISTS cosmetic_loadouts (
      wallet TEXT PRIMARY KEY,
      aura_sku TEXT,
      nameplate_sku TEXT,
      chat_bubble_sku TEXT,
      trail_sku TEXT
    );
  `);
    cosmeticTablesReady = true;
  }
  runCosmeticsV2HardResetIfNeeded();
}

/** Test-only: reset module singletons so each temp SQLite file is isolated. */
export function _resetCosmeticStoreForTests(): void {
  cosmeticTablesReady = false;
  _resetCampaignStoreForTests();
}

function rowToPublic(row: CatalogRow): CatalogEntryPublic {
  const preset = getCosmeticPreset(row.preset_id);
  return {
    cosmeticSku: row.cosmetic_sku,
    presetId: row.preset_id,
    slot: preset?.slot ?? "aura",
    status: row.status,
    displayName: row.display_name,
    description: row.description,
    collection: row.collection,
    sortOrder: row.sort_order,
    priceLuna: row.price_luna,
    cooldownSec: row.cooldown_sec,
    durationSec: row.duration_sec,
    roomCap: row.room_cap,
    deployRange: row.deploy_range,
    createdAt: new Date(row.created_at_ms).toISOString(),
    updatedAt: new Date(row.updated_at_ms).toISOString(),
  };
}

function catalogSnapshot(entry: CatalogEntryPublic): Record<string, unknown> {
  return {
    cosmeticSku: entry.cosmeticSku,
    presetId: entry.presetId,
    status: entry.status,
    displayName: entry.displayName,
    description: entry.description,
    collection: entry.collection,
    sortOrder: entry.sortOrder,
    priceLuna: entry.priceLuna,
    cooldownSec: entry.cooldownSec,
    durationSec: entry.durationSec,
    roomCap: entry.roomCap,
    deployRange: entry.deployRange,
  };
}

function appendChangelog(
  cosmeticSku: string,
  actorWallet: string,
  action: ChangelogAction,
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
  extra?: Record<string, unknown>
): void {
  const afterMerged = after ? { ...after, ...extra } : extra ?? null;
  requireDb()
    .prepare(
      `INSERT INTO cosmetic_changelog
        (id, cosmetic_sku, at_ms, actor_wallet, action, before_json, after_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      randomUUID(),
      cosmeticSku,
      Date.now(),
      normalizeWallet(actorWallet),
      action,
      before ? JSON.stringify(before) : null,
      afterMerged ? JSON.stringify(afterMerged) : null
    );
}

export { listCosmeticPresets, getCosmeticPreset };

export function getCatalogEntry(
  cosmeticSku: string
): CatalogEntryPublic | null {
  const sku = normalizeSku(cosmeticSku);
  if (!sku) return null;
  const row = requireDb()
    .prepare(`SELECT * FROM cosmetic_catalog WHERE cosmetic_sku = ?`)
    .get(sku) as CatalogRow | undefined;
  return row ? rowToPublic(row) : null;
}

export function listAdminCatalog(): CatalogEntryPublic[] {
  const rows = requireDb()
    .prepare(
      `SELECT * FROM cosmetic_catalog ORDER BY collection COLLATE NOCASE, sort_order, display_name`
    )
    .all() as CatalogRow[];
  return rows.map(rowToPublic);
}

export function listPublishedShop(): CatalogEntryPublic[] {
  const rows = requireDb()
    .prepare(
      `SELECT * FROM cosmetic_catalog WHERE status = 'published'
       AND LOWER(collection) != 'achievements'
       ORDER BY collection COLLATE NOCASE, sort_order, display_name`
    )
    .all() as CatalogRow[];
  return rows.map(rowToPublic);
}

/** FNV-1a 32-bit hash — small, dependency-free, stable across runs. */
function hashStringToUint32(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Deterministically pick up to `count` entries from `entries` for a given `dayKey`
 * (e.g. `2026-06-29`). Pure: the same pool + day key always yields the same ordered
 * subset, while different day keys shuffle differently. Used for the global daily
 * featured shop shelf so every player sees the same items on a given UTC day.
 */
export function selectDailyFeatured<T extends { cosmeticSku: string }>(
  entries: readonly T[],
  dayKey: string,
  count: number
): T[] {
  if (count <= 0 || entries.length === 0) return [];
  const ranked = [...entries]
    .map((entry) => ({
      entry,
      rank: hashStringToUint32(`${dayKey}:${entry.cosmeticSku}`),
    }))
    .sort(
      (a, b) =>
        a.rank - b.rank || a.entry.cosmeticSku.localeCompare(b.entry.cosmeticSku)
    );
  return ranked.slice(0, count).map((r) => r.entry);
}

/** UTC day key (`YYYY-MM-DD`) for the global daily featured shelf. */
export function utcDayKey(at: Date = new Date()): string {
  return at.toISOString().slice(0, 10);
}

/**
 * Global daily featured shelf: up to `count` Published, shop-eligible Catalog Entries,
 * identical for every player on a given UTC day, annotated with per-wallet `owned`.
 */
export function listDailyFeaturedShop(
  wallet: string,
  count = 5,
  dayKey: string = utcDayKey()
): Array<CatalogEntryPublic & { owned: boolean }> {
  const featured = selectDailyFeatured(listPublishedShop(), dayKey, count);
  const ownedSkus = new Set(listEntitlements(wallet).map((e) => e.cosmeticSku));
  return featured.map((entry) => ({
    ...entry,
    owned: ownedSkus.has(entry.cosmeticSku),
  }));
}

/** Shop rows for wardrobe UI: purchasable catalog plus owned achievement (and other non-shop) passives. */
export function listWardrobeShop(
  wallet: string
): Array<CatalogEntryPublic & { owned: boolean }> {
  const ownedSkus = new Set(listEntitlements(wallet).map((e) => e.cosmeticSku));
  const bySku = new Map<string, CatalogEntryPublic & { owned: boolean }>();

  for (const entry of listPublishedShop()) {
    bySku.set(entry.cosmeticSku, {
      ...entry,
      owned: ownedSkus.has(entry.cosmeticSku),
    });
  }

  for (const sku of ownedSkus) {
    if (bySku.has(sku)) continue;
    const entry = getCatalogEntry(sku);
    if (!entry || entry.status !== "published") continue;
    if (!isPassiveSlot(entry.slot)) continue;
    bySku.set(sku, { ...entry, owned: true });
  }

  return [...bySku.values()].sort(
    (a, b) =>
      a.collection.localeCompare(b.collection, undefined, { sensitivity: "base" }) ||
      a.sortOrder - b.sortOrder ||
      a.displayName.localeCompare(b.displayName)
  );
}

export function getCatalogChangelog(
  cosmeticSku: string
): ChangelogRowPublic[] {
  const sku = normalizeSku(cosmeticSku);
  if (!sku) return [];
  const rows = requireDb()
    .prepare(
      `SELECT * FROM cosmetic_changelog WHERE cosmetic_sku = ?
       ORDER BY at_ms DESC`
    )
    .all(sku) as Array<{
    id: string;
    cosmetic_sku: string;
    at_ms: number;
    actor_wallet: string;
    action: ChangelogAction;
    before_json: string | null;
    after_json: string | null;
  }>;
  return rows.map((r) => ({
    id: r.id,
    cosmeticSku: r.cosmetic_sku,
    at: new Date(r.at_ms).toISOString(),
    actorWallet: r.actor_wallet,
    action: r.action,
    before: r.before_json ? (JSON.parse(r.before_json) as Record<string, unknown>) : null,
    after: r.after_json ? (JSON.parse(r.after_json) as Record<string, unknown>) : null,
  }));
}

export function createCatalogEntry(
  input: {
    cosmeticSku: string;
    presetId: string;
    displayName: string;
    description?: string;
    collection?: string;
    sortOrder?: number;
    priceLuna: bigint;
    cooldownSec?: number | null;
    durationSec?: number | null;
    roomCap?: number | null;
    deployRange?: number | null;
  },
  actorWallet: string
):
  | { ok: true; entry: CatalogEntryPublic }
  | { ok: false; error: string } {
  const sku = normalizeSku(input.cosmeticSku);
  if (!sku || sku.length < 2 || sku.length > 64) {
    return { ok: false, error: "invalid_sku" };
  }
  const preset = getCosmeticPreset(input.presetId);
  if (!preset) return { ok: false, error: "invalid_preset" };
  const displayName = String(input.displayName ?? "").trim();
  if (!displayName || displayName.length > 80) {
    return { ok: false, error: "invalid_display_name" };
  }
  const priceLuna = input.priceLuna;
  if (priceLuna < 0n) return { ok: false, error: "invalid_price" };

  let cooldownSec: number | null = null;
  let durationSec: number | null = null;
  let roomCap: number | null = null;
  let deployRange: number | null = null;
  if (preset.slot === "deployable") {
    if (input.cooldownSec != null) {
      cooldownSec = clampDeployParam("cooldownSec", input.cooldownSec);
      if (cooldownSec == null) return { ok: false, error: "invalid_deploy_param" };
    }
    if (input.durationSec != null) {
      durationSec = clampDeployParam("durationSec", input.durationSec);
      if (durationSec == null) return { ok: false, error: "invalid_deploy_param" };
    }
    if (input.roomCap != null) {
      roomCap = clampDeployParam("roomCap", input.roomCap);
      if (roomCap == null) return { ok: false, error: "invalid_deploy_param" };
    }
    if (input.deployRange != null) {
      deployRange = clampDeployParam("deployRange", input.deployRange);
      if (deployRange == null) return { ok: false, error: "invalid_deploy_param" };
    }
  }

  const now = Date.now();
  try {
    requireDb()
      .prepare(
        `INSERT INTO cosmetic_catalog
          (cosmetic_sku, preset_id, status, display_name, description, collection,
           sort_order, price_luna, cooldown_sec, duration_sec, room_cap, deploy_range,
           created_at_ms, updated_at_ms)
         VALUES (?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        sku,
        preset.presetId,
        displayName,
        String(input.description ?? "").trim().slice(0, 500),
        String(input.collection ?? "").trim().slice(0, 80),
        Math.floor(Number(input.sortOrder) || 0),
        priceLuna.toString(),
        cooldownSec,
        durationSec,
        roomCap,
        deployRange,
        now,
        now
      );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("UNIQUE")) return { ok: false, error: "sku_exists" };
    throw e;
  }

  const entry = getCatalogEntry(sku)!;
  appendChangelog(sku, actorWallet, "created", null, catalogSnapshot(entry));
  return { ok: true, entry };
}

export function updateCatalogEntry(
  cosmeticSku: string,
  patch: {
    displayName?: string;
    description?: string;
    collection?: string;
    sortOrder?: number;
    priceLuna?: bigint;
    cooldownSec?: number | null;
    durationSec?: number | null;
    roomCap?: number | null;
    deployRange?: number | null;
  },
  actorWallet: string
):
  | { ok: true; entry: CatalogEntryPublic }
  | { ok: false; error: string } {
  const before = getCatalogEntry(cosmeticSku);
  if (!before) return { ok: false, error: "not_found" };

  const displayName =
    patch.displayName !== undefined
      ? String(patch.displayName).trim()
      : before.displayName;
  if (!displayName || displayName.length > 80) {
    return { ok: false, error: "invalid_display_name" };
  }
  const priceLuna =
    patch.priceLuna !== undefined ? patch.priceLuna : BigInt(before.priceLuna);
  if (priceLuna < 0n) return { ok: false, error: "invalid_price" };

  let cooldownSec = before.cooldownSec;
  let durationSec = before.durationSec;
  let roomCap = before.roomCap;
  let deployRange = before.deployRange;
  if (before.slot === "deployable") {
    const applyField = (
      field: keyof DeployDefaults,
      current: number | null,
      next: number | null | undefined
    ): number | null | "invalid" => {
      if (next === undefined) return current;
      if (next === null) return null;
      const clamped = clampDeployParam(field, next);
      return clamped == null ? "invalid" : clamped;
    };
    const c = applyField("cooldownSec", cooldownSec, patch.cooldownSec);
    if (c === "invalid") return { ok: false, error: "invalid_deploy_param" };
    cooldownSec = c;
    const d = applyField("durationSec", durationSec, patch.durationSec);
    if (d === "invalid") return { ok: false, error: "invalid_deploy_param" };
    durationSec = d;
    const r = applyField("roomCap", roomCap, patch.roomCap);
    if (r === "invalid") return { ok: false, error: "invalid_deploy_param" };
    roomCap = r;
    const dr = applyField("deployRange", deployRange, patch.deployRange);
    if (dr === "invalid") return { ok: false, error: "invalid_deploy_param" };
    deployRange = dr;
  }

  const now = Date.now();
  requireDb()
    .prepare(
      `UPDATE cosmetic_catalog SET
        display_name = ?, description = ?, collection = ?, sort_order = ?,
        price_luna = ?, cooldown_sec = ?, duration_sec = ?, room_cap = ?,
        deploy_range = ?, updated_at_ms = ?
       WHERE cosmetic_sku = ?`
    )
    .run(
      displayName,
      patch.description !== undefined
        ? String(patch.description).trim().slice(0, 500)
        : before.description,
      patch.collection !== undefined
        ? String(patch.collection).trim().slice(0, 80)
        : before.collection,
      patch.sortOrder !== undefined
        ? Math.floor(Number(patch.sortOrder) || 0)
        : before.sortOrder,
      priceLuna.toString(),
      cooldownSec,
      durationSec,
      roomCap,
      deployRange,
      now,
      before.cosmeticSku
    );

  const after = getCatalogEntry(before.cosmeticSku)!;
  appendChangelog(
    before.cosmeticSku,
    actorWallet,
    "updated",
    catalogSnapshot(before),
    catalogSnapshot(after)
  );
  return { ok: true, entry: after };
}

export function publishCatalogEntry(
  cosmeticSku: string,
  actorWallet: string
):
  | { ok: true; entry: CatalogEntryPublic }
  | { ok: false; error: string } {
  const before = getCatalogEntry(cosmeticSku);
  if (!before) return { ok: false, error: "not_found" };
  if (before.status !== "draft") return { ok: false, error: "invalid_status" };
  const now = Date.now();
  const info = requireDb()
    .prepare(
      `UPDATE cosmetic_catalog SET status = 'published', updated_at_ms = ?
       WHERE cosmetic_sku = ? AND status = 'draft'`
    )
    .run(now, before.cosmeticSku);
  if (info.changes === 0) return { ok: false, error: "invalid_status" };
  const after = getCatalogEntry(before.cosmeticSku)!;
  appendChangelog(
    before.cosmeticSku,
    actorWallet,
    "published",
    catalogSnapshot(before),
    catalogSnapshot(after)
  );
  return { ok: true, entry: after };
}

export function archiveCatalogEntry(
  cosmeticSku: string,
  actorWallet: string
):
  | { ok: true; entry: CatalogEntryPublic }
  | { ok: false; error: string } {
  const before = getCatalogEntry(cosmeticSku);
  if (!before) return { ok: false, error: "not_found" };
  if (before.status !== "published") return { ok: false, error: "invalid_status" };
  const now = Date.now();
  const info = requireDb()
    .prepare(
      `UPDATE cosmetic_catalog SET status = 'archived', updated_at_ms = ?
       WHERE cosmetic_sku = ? AND status = 'published'`
    )
    .run(now, before.cosmeticSku);
  if (info.changes === 0) return { ok: false, error: "invalid_status" };
  const after = getCatalogEntry(before.cosmeticSku)!;
  appendChangelog(
    before.cosmeticSku,
    actorWallet,
    "archived",
    catalogSnapshot(before),
    catalogSnapshot(after)
  );
  return { ok: true, entry: after };
}

export function hasEntitlement(wallet: string, cosmeticSku: string): boolean {
  const w = normalizeWallet(wallet);
  const sku = normalizeSku(cosmeticSku);
  if (!w || !sku) return false;
  const row = requireDb()
    .prepare(
      `SELECT 1 FROM cosmetic_entitlements WHERE wallet = ? AND cosmetic_sku = ?`
    )
    .get(w, sku);
  return row != null;
}

export function listEntitlements(wallet: string): EntitlementPublic[] {
  const w = normalizeWallet(wallet);
  if (!w) return [];
  const rows = requireDb()
    .prepare(
      `SELECT * FROM cosmetic_entitlements WHERE wallet = ? ORDER BY granted_at_ms DESC`
    )
    .all(w) as Array<{
    cosmetic_sku: string;
    granted_at_ms: number;
    source: EntitlementSource;
    intent_id: string | null;
    tx_hash: string | null;
  }>;
  return rows.map((r) => ({
    cosmeticSku: r.cosmetic_sku,
    grantedAt: new Date(r.granted_at_ms).toISOString(),
    source: r.source,
    intentId: r.intent_id,
    txHash: r.tx_hash,
  }));
}

export function grantEntitlement(
  wallet: string,
  cosmeticSku: string,
  actorWallet: string,
  source: EntitlementSource,
  opts?: { intentId?: string; txHash?: string }
): { ok: true; created: boolean } | { ok: false; error: string } {
  const w = normalizeWallet(wallet);
  const sku = normalizeSku(cosmeticSku);
  if (!w || !sku) return { ok: false, error: "invalid_wallet" };
  const entry = getCatalogEntry(sku);
  if (!entry) return { ok: false, error: "not_found" };

  const now = Date.now();
  const existing = hasEntitlement(w, sku);
  if (!existing) {
    requireDb()
      .prepare(
        `INSERT INTO cosmetic_entitlements
          (wallet, cosmetic_sku, granted_at_ms, source, intent_id, tx_hash)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        w,
        sku,
        now,
        source,
        opts?.intentId ?? null,
        opts?.txHash ?? null
      );
  }

  appendChangelog(sku, actorWallet, "granted", null, null, {
    targetWallet: w,
    source,
    created: !existing,
  });
  return { ok: true, created: !existing };
}

export function grantEntitlementFromPurchase(
  wallet: string,
  cosmeticSku: string,
  opts: { intentId: string; txHash: string }
):
  | { ok: true; granted: boolean }
  | { ok: false; error: string } {
  const w = normalizeWallet(wallet);
  const sku = normalizeSku(cosmeticSku);
  if (!w || !sku) return { ok: false, error: "invalid_wallet" };
  const entry = getCatalogEntry(sku);
  if (!entry) return { ok: false, error: "not_found" };
  if (entry.status === "archived") return { ok: false, error: "archived" };

  if (hasEntitlement(w, sku)) {
    return { ok: true, granted: false };
  }

  const now = Date.now();
  requireDb()
    .prepare(
      `INSERT INTO cosmetic_entitlements
        (wallet, cosmetic_sku, granted_at_ms, source, intent_id, tx_hash)
       VALUES (?, ?, ?, 'purchase', ?, ?)`
    )
    .run(w, sku, now, opts.intentId, opts.txHash);
  return { ok: true, granted: true };
}

export function validateUnlockIntent(
  wallet: string,
  cosmeticSku: string
):
  | { ok: true; entry: CatalogEntryPublic; amountLuna: bigint }
  | { ok: false; error: string } {
  const skuNorm = normalizeSku(cosmeticSku);
  if (skuNorm.startsWith("ach-")) {
    return { ok: false, error: "achievement_only" };
  }
  const entry = getCatalogEntry(cosmeticSku);
  if (!entry || entry.status !== "published") {
    return { ok: false, error: "not_published" };
  }
  if (entry.collection.trim().toLowerCase() === "achievements") {
    return { ok: false, error: "achievement_only" };
  }
  if (hasEntitlement(wallet, entry.cosmeticSku)) {
    return { ok: false, error: "already_owned" };
  }
  let amountLuna: bigint;
  try {
    amountLuna = BigInt(entry.priceLuna);
  } catch {
    return { ok: false, error: "invalid_price" };
  }
  if (amountLuna < 1n) return { ok: false, error: "invalid_price" };
  return { ok: true, entry, amountLuna };
}

export function getLoadout(wallet: string): LoadoutPublic {
  const w = normalizeWallet(wallet);
  if (!w) {
    return {
      auraSku: null,
      nameplateSku: null,
      chatBubbleSku: null,
      trailSku: null,
    };
  }
  const row = requireDb()
    .prepare(`SELECT * FROM cosmetic_loadouts WHERE wallet = ?`)
    .get(w) as
    | {
        aura_sku: string | null;
        nameplate_sku: string | null;
        chat_bubble_sku: string | null;
        trail_sku: string | null;
      }
    | undefined;
  if (!row) {
    return {
      auraSku: null,
      nameplateSku: null,
      chatBubbleSku: null,
      trailSku: null,
    };
  }
  return {
    auraSku: row.aura_sku,
    nameplateSku: row.nameplate_sku,
    chatBubbleSku: row.chat_bubble_sku,
    trailSku: row.trail_sku,
  };
}

const LOADOUT_COLUMN: Record<PassiveSlot, string> = {
  aura: "aura_sku",
  nameplate: "nameplate_sku",
  chatBubble: "chat_bubble_sku",
  trail: "trail_sku",
};

export function setLoadoutSlot(
  wallet: string,
  slot: PassiveSlot,
  cosmeticSku: string | null
): { ok: true } | { ok: false; error: string } {
  if (!isPassiveSlot(slot)) return { ok: false, error: "invalid_slot" };
  const w = normalizeWallet(wallet);
  if (!w) return { ok: false, error: "invalid_wallet" };

  if (cosmeticSku != null) {
    const sku = normalizeSku(cosmeticSku);
    const entry = getCatalogEntry(sku);
    if (!entry) return { ok: false, error: "not_found" };
    if (entry.slot !== slot) return { ok: false, error: "slot_mismatch" };
    if (!hasEntitlement(w, sku)) return { ok: false, error: "not_owned" };
    cosmeticSku = sku;
  }

  const col = LOADOUT_COLUMN[slot];
  requireDb()
    .prepare(
      `INSERT INTO cosmetic_loadouts (wallet, ${col})
       VALUES (?, ?)
       ON CONFLICT(wallet) DO UPDATE SET ${col} = excluded.${col}`
    )
    .run(w, cosmeticSku);
  return { ok: true };
}

export function getResolvedDeployRules(
  cosmeticSku: string
): DeployDefaults | null {
  const entry = getCatalogEntry(cosmeticSku);
  if (!entry || entry.slot !== "deployable") return null;
  return resolveDeployRules(entry.presetId, {
    cooldownSec: entry.cooldownSec ?? undefined,
    durationSec: entry.durationSec ?? undefined,
    roomCap: entry.roomCap ?? undefined,
    deployRange: entry.deployRange ?? undefined,
  });
}

export function getPublicLoadoutForWallet(
  wallet: string
): LoadoutPublic & { presetIds: Partial<Record<PassiveSlot, string>> } {
  const loadout = getLoadout(wallet);
  const presetIds: Partial<Record<PassiveSlot, string>> = {};
  const slots: PassiveSlot[] = ["aura", "nameplate", "chatBubble", "trail"];
  for (const slot of slots) {
    const skuKey = `${slot}Sku` as keyof LoadoutPublic;
    const sku = loadout[skuKey] as string | null;
    if (sku) {
      const entry = getCatalogEntry(sku);
      if (entry) presetIds[slot] = entry.presetId;
    }
  }
  return { ...loadout, presetIds };
}

export function listOwnedDeployables(
  wallet: string
): Array<CatalogEntryPublic & { deployRules: DeployDefaults }> {
  const owned = listEntitlements(wallet);
  const out: Array<CatalogEntryPublic & { deployRules: DeployDefaults }> = [];
  for (const e of owned) {
    const entry = getCatalogEntry(e.cosmeticSku);
    if (!entry || entry.slot !== "deployable") continue;
    const rules = getResolvedDeployRules(entry.cosmeticSku);
    if (rules) out.push({ ...entry, deployRules: rules });
  }
  return out;
}

/** Main-menu dev login wallet (compact; input may include spaces). */
export const DEV_LOGIN_WALLET = "NQ07DEV0000000000000000000000000000000000";

function isDevCosmeticUnlockEnabled(): boolean {
  return (
    process.env.NODE_ENV === "development" &&
    process.env.DEV_AUTH_BYPASS === "1"
  );
}

export function isDevLoginWallet(wallet: string): boolean {
  return normalizeWallet(wallet) === DEV_LOGIN_WALLET;
}

function seedDevCosmeticCatalog(): void {
  const existingPresetIds = new Set(
    (
      requireDb()
        .prepare(`SELECT DISTINCT preset_id AS preset_id FROM cosmetic_catalog`)
        .all() as Array<{ preset_id: string }>
    ).map((row) => row.preset_id)
  );
  let sortOrder = 1000;
  for (const preset of listCosmeticPresets()) {
    if (existingPresetIds.has(preset.presetId)) continue;
    const sku = `dev-${preset.presetId}`;
    const created = createCatalogEntry(
      {
        cosmeticSku: sku,
        presetId: preset.presetId,
        displayName: preset.label,
        description: "Dev catalog seed.",
        collection: "Dev",
        sortOrder: sortOrder++,
        priceLuna: 0n,
        cooldownSec: preset.deployDefaults?.cooldownSec,
        durationSec: preset.deployDefaults?.durationSec,
        roomCap: preset.deployDefaults?.roomCap,
        deployRange: preset.deployDefaults?.deployRange,
      },
      DEV_LOGIN_WALLET
    );
    if (created.ok) {
      publishCatalogEntry(sku, DEV_LOGIN_WALLET);
    }
  }
}

/** Dev bypass only: ensure catalog coverage and grant every Catalog Entry to the dev login wallet. */
export function ensureDevWalletAllCosmeticEntitlements(wallet: string): void {
  if (!isDevCosmeticUnlockEnabled()) return;
  if (!isDevLoginWallet(wallet)) return;
  seedDevCosmeticCatalog();
  for (const entry of listAdminCatalog()) {
    grantEntitlement(wallet, entry.cosmeticSku, DEV_LOGIN_WALLET, "grant");
  }
}
