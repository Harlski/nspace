import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import { getBillboardAdvertById } from "./billboardAdvertsCatalog.js";
import { initCampaignStore, getCampaignDatabase } from "./campaignStore.js";

export type RotationSetItemKind = "placeholder" | "campaign";

export type RotationSetItemPublic = {
  id: string;
  kind: RotationSetItemKind;
  placeholderAdvertId: string | null;
  campaignId: string | null;
  sortOrder: number;
};

export type RotationSetPublic = {
  id: string;
  name: string;
  placeholderDwellSec: number;
  revision: number;
  items: RotationSetItemPublic[];
  createdAt: string;
  updatedAt: string;
};

export type RotationSetSummary = {
  id: string;
  name: string;
  revision: number;
  itemCount: number;
};

function requireDb(): Database.Database {
  initCampaignStore();
  return getCampaignDatabase();
}

export function initRotationSetStore(): void {
  initCampaignStore();
  const database = requireDb();
  database.exec(`
    CREATE TABLE IF NOT EXISTS rotation_sets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      placeholder_dwell_sec INTEGER NOT NULL DEFAULT 10,
      revision INTEGER NOT NULL DEFAULT 1,
      created_at_ms INTEGER NOT NULL,
      updated_at_ms INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS rotation_set_items (
      id TEXT PRIMARY KEY,
      set_id TEXT NOT NULL,
      sort_order INTEGER NOT NULL,
      item_kind TEXT NOT NULL,
      placeholder_advert_id TEXT,
      campaign_id TEXT,
      FOREIGN KEY (set_id) REFERENCES rotation_sets(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS ix_rotation_set_items_set ON rotation_set_items(set_id);
  `);
}

function rowToSet(
  row: {
    id: string;
    name: string;
    placeholder_dwell_sec: number;
    revision: number;
    created_at_ms: number;
    updated_at_ms: number;
  },
  items: RotationSetItemPublic[]
): RotationSetPublic {
  return {
    id: row.id,
    name: row.name,
    placeholderDwellSec: Math.max(
      1,
      Math.min(300, Math.floor(Number(row.placeholder_dwell_sec) || 10))
    ),
    revision: Math.max(1, Math.floor(Number(row.revision) || 1)),
    items,
    createdAt: new Date(row.created_at_ms).toISOString(),
    updatedAt: new Date(row.updated_at_ms).toISOString(),
  };
}

function loadItemsForSet(setId: string): RotationSetItemPublic[] {
  const rows = requireDb()
    .prepare(
      `SELECT * FROM rotation_set_items WHERE set_id = ? ORDER BY sort_order ASC`
    )
    .all(setId.trim()) as Array<{
    id: string;
    set_id: string;
    sort_order: number;
    item_kind: string;
    placeholder_advert_id: string | null;
    campaign_id: string | null;
  }>;
  return rows.map((r) => ({
    id: r.id,
    kind: r.item_kind === "campaign" ? "campaign" : "placeholder",
    placeholderAdvertId: r.placeholder_advert_id,
    campaignId: r.campaign_id,
    sortOrder: r.sort_order,
  }));
}

function bumpRevision(setId: string): number {
  const now = Date.now();
  requireDb()
    .prepare(
      `UPDATE rotation_sets SET revision = revision + 1, updated_at_ms = ? WHERE id = ?`
    )
    .run(now, setId.trim());
  const row = requireDb()
    .prepare(`SELECT revision FROM rotation_sets WHERE id = ?`)
    .get(setId.trim()) as { revision: number } | undefined;
  return Math.max(1, Math.floor(Number(row?.revision) || 1));
}

export function listRotationSetSummaries(): RotationSetSummary[] {
  const rows = requireDb()
    .prepare(`SELECT id, name, revision FROM rotation_sets ORDER BY name ASC`)
    .all() as Array<{ id: string; name: string; revision: number }>;
  return rows.map((r) => {
    const count = requireDb()
      .prepare(`SELECT COUNT(*) AS c FROM rotation_set_items WHERE set_id = ?`)
      .get(r.id) as { c: number };
    return {
      id: r.id,
      name: r.name,
      revision: Math.max(1, Math.floor(Number(r.revision) || 1)),
      itemCount: Math.max(0, Math.floor(Number(count.c) || 0)),
    };
  });
}

export function listRotationSets(): RotationSetPublic[] {
  const rows = requireDb()
    .prepare(`SELECT * FROM rotation_sets ORDER BY name ASC`)
    .all() as Array<{
    id: string;
    name: string;
    placeholder_dwell_sec: number;
    revision: number;
    created_at_ms: number;
    updated_at_ms: number;
  }>;
  return rows.map((r) => rowToSet(r, loadItemsForSet(r.id)));
}

export function getRotationSetById(id: string): RotationSetPublic | null {
  const row = requireDb()
    .prepare(`SELECT * FROM rotation_sets WHERE id = ?`)
    .get(id.trim()) as
    | {
        id: string;
        name: string;
        placeholder_dwell_sec: number;
        revision: number;
        created_at_ms: number;
        updated_at_ms: number;
      }
    | undefined;
  if (!row) return null;
  return rowToSet(row, loadItemsForSet(row.id));
}

const DEFAULT_PLACEHOLDER_IDS = ["nimiq_bb", "join_nimiqspace_telegram_bb"];

export function createRotationSet(input: {
  name: string;
  placeholderDwellSec?: number;
  items?: Array<
    | { kind: "placeholder"; placeholderAdvertId: string }
    | { kind: "campaign"; campaignId: string }
  >;
}): RotationSetPublic | null {
  const name = String(input.name ?? "").trim();
  if (!name || name.length > 80) return null;
  const placeholderDwellSec = Math.max(
    1,
    Math.min(300, Math.floor(Number(input.placeholderDwellSec) || 10))
  );
  const now = Date.now();
  const id = randomUUID();
  const database = requireDb();
  database
    .prepare(
      `INSERT INTO rotation_sets (
        id, name, placeholder_dwell_sec, revision, created_at_ms, updated_at_ms
      ) VALUES (?, ?, ?, 1, ?, ?)`
    )
    .run(id, name, placeholderDwellSec, now, now);

  const seedItems = input.items?.length
    ? input.items
    : DEFAULT_PLACEHOLDER_IDS.map((placeholderAdvertId) => ({
        kind: "placeholder" as const,
        placeholderAdvertId,
      }));
  replaceRotationSetItems(id, seedItems);
  return getRotationSetById(id);
}

export function updateRotationSetMeta(
  id: string,
  patch: { name?: string; placeholderDwellSec?: number }
): RotationSetPublic | null {
  const existing = getRotationSetById(id);
  if (!existing) return null;
  const name =
    patch.name !== undefined ? String(patch.name).trim() : existing.name;
  if (!name || name.length > 80) return null;
  let placeholderDwellSec = existing.placeholderDwellSec;
  if (patch.placeholderDwellSec !== undefined) {
    placeholderDwellSec = Math.max(
      1,
      Math.min(300, Math.floor(Number(patch.placeholderDwellSec) || 10))
    );
  }
  const now = Date.now();
  requireDb()
    .prepare(
      `UPDATE rotation_sets SET name = ?, placeholder_dwell_sec = ?, updated_at_ms = ? WHERE id = ?`
    )
    .run(name, placeholderDwellSec, now, id.trim());
  bumpRevision(id);
  return getRotationSetById(id);
}

export function replaceRotationSetItems(
  setId: string,
  items: Array<
    | { kind: "placeholder"; placeholderAdvertId: string }
    | { kind: "campaign"; campaignId: string }
  >
): RotationSetPublic | null {
  const existing = getRotationSetById(setId);
  if (!existing) return null;
  const database = requireDb();
  const tx = database.transaction(() => {
    database
      .prepare(`DELETE FROM rotation_set_items WHERE set_id = ?`)
      .run(setId.trim());
    let order = 0;
    for (const item of items.slice(0, 8)) {
      if (item.kind === "placeholder") {
        const advertId = String(item.placeholderAdvertId ?? "").trim();
        if (!getBillboardAdvertById(advertId)) continue;
        database
          .prepare(
            `INSERT INTO rotation_set_items (
              id, set_id, sort_order, item_kind, placeholder_advert_id, campaign_id
            ) VALUES (?, ?, ?, 'placeholder', ?, NULL)`
          )
          .run(randomUUID(), setId.trim(), order, advertId);
        order++;
        continue;
      }
      const campaignId = String(item.campaignId ?? "").trim();
      if (!campaignId) continue;
      database
        .prepare(
          `INSERT INTO rotation_set_items (
            id, set_id, sort_order, item_kind, placeholder_advert_id, campaign_id
          ) VALUES (?, ?, ?, 'campaign', NULL, ?)`
        )
        .run(randomUUID(), setId.trim(), order, campaignId);
      order++;
    }
  });
  tx();
  bumpRevision(setId);
  return getRotationSetById(setId);
}

export function deleteRotationSet(id: string): boolean {
  const info = requireDb()
    .prepare(`DELETE FROM rotation_sets WHERE id = ?`)
    .run(id.trim());
  return info.changes > 0;
}

export function removeCampaignFromAllRotationSets(campaignId: string): string[] {
  const cid = campaignId.trim();
  const sets = requireDb()
    .prepare(
      `SELECT DISTINCT set_id FROM rotation_set_items WHERE campaign_id = ?`
    )
    .all(cid) as Array<{ set_id: string }>;
  if (!sets.length) return [];
  requireDb()
    .prepare(`DELETE FROM rotation_set_items WHERE campaign_id = ?`)
    .run(cid);
  const touched: string[] = [];
  for (const row of sets) {
    touched.push(row.set_id);
    bumpRevision(row.set_id);
  }
  return touched;
}

export function listRotationSetIdsContainingCampaign(
  campaignId: string
): string[] {
  const rows = requireDb()
    .prepare(
      `SELECT DISTINCT set_id FROM rotation_set_items WHERE campaign_id = ?`
    )
    .all(campaignId.trim()) as Array<{ set_id: string }>;
  return rows.map((r) => r.set_id);
}

/** Campaign ids referenced by at least one rotation set slide. */
export function campaignIdsInRotationSets(): Set<string> {
  const rows = requireDb()
    .prepare(
      `SELECT DISTINCT campaign_id FROM rotation_set_items
       WHERE campaign_id IS NOT NULL AND TRIM(campaign_id) != ''`
    )
    .all() as Array<{ campaign_id: string }>;
  const out = new Set<string>();
  for (const row of rows) {
    const id = String(row.campaign_id ?? "").trim();
    if (id) out.add(id);
  }
  return out;
}
