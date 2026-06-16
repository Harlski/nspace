import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import Database from "better-sqlite3";
import { validateBillboardHttpsTarget } from "./billboardAdvertsCatalog.js";
import { isAllowedBillboardImageUrl } from "./billboards.js";
import {
  CAMPAIGN_PLACEMENT_ACTIVE_CAROUSEL,
  campaignSqlitePath,
  isCampaignSlideDwellSec,
  lunaDrainForVisibleMs,
  type CampaignPlacementMode,
} from "./advertiseConfig.js";

export type CampaignStatus =
  | "draft"
  | "pending_payment"
  | "pending_approval"
  | "approved"
  | "rejected"
  | "expired"
  /** @deprecated migrated to `approved` */
  | "active";

export type CampaignRow = {
  id: string;
  owner_wallet: string;
  project_name: string;
  miniapp_target_url: string;
  image_url: string;
  status: CampaignStatus;
  intent_id: string | null;
  tx_hash: string | null;
  billboard_id: string | null;
  room_id: string | null;
  anchor_x: number | null;
  anchor_z: number | null;
  expires_at_ms: number | null;
  placement_mode: string;
  display_interval_sec: number;
  balance_luna: string | null;
  reject_note: string | null;
  created_at_ms: number;
  updated_at_ms: number;
};

export type CampaignPublic = {
  id: string;
  ownerWallet: string;
  projectName: string;
  miniappTargetUrl: string;
  imageUrl: string;
  status: CampaignStatus;
  intentId: string | null;
  txHash: string | null;
  billboardId: string | null;
  roomId: string | null;
  anchorX: number | null;
  anchorZ: number | null;
  expiresAt: string | null;
  placementMode: CampaignPlacementMode;
  displayIntervalSec: number;
  /** Reserved for balance-based drain (phase 2+). */
  balanceLuna: string | null;
  rejectNote: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CampaignTransactionPublic = {
  id: string;
  campaignId: string;
  intentId: string | null;
  txHash: string;
  amountLuna: string;
  amountNimLabel: string;
  recordedAt: string;
  explorerUrl: string;
};

type CampaignTransactionRow = {
  id: string;
  campaign_id: string;
  intent_id: string | null;
  tx_hash: string;
  amount_luna: string;
  recorded_at_ms: number;
};

const LUNA_PER_NIM = 100_000n;

function normalizeWallet(v: string): string {
  return String(v || "").replace(/\s+/g, "").toUpperCase();
}

function rowToPublic(row: CampaignRow): CampaignPublic {
  return {
    id: row.id,
    ownerWallet: row.owner_wallet,
    projectName: row.project_name,
    miniappTargetUrl: row.miniapp_target_url,
    imageUrl: row.image_url,
    status: row.status,
    intentId: row.intent_id,
    txHash: row.tx_hash,
    billboardId: row.billboard_id,
    roomId: row.room_id,
    anchorX: row.anchor_x,
    anchorZ: row.anchor_z,
    expiresAt:
      row.expires_at_ms != null
        ? new Date(row.expires_at_ms).toISOString()
        : null,
    placementMode:
      row.placement_mode === "dedicated_anchor"
        ? "dedicated_anchor"
        : CAMPAIGN_PLACEMENT_ACTIVE_CAROUSEL,
    displayIntervalSec: Math.max(
      10,
      Math.min(45, Math.floor(Number(row.display_interval_sec) || 30))
    ),
    balanceLuna: row.balance_luna,
    rejectNote: row.reject_note,
    createdAt: new Date(row.created_at_ms).toISOString(),
    updatedAt: new Date(row.updated_at_ms).toISOString(),
  };
}

export function initCampaignStore(): void {
  if (db) return;
  const sqlitePath = campaignSqlitePath();
  const dir = path.dirname(path.resolve(sqlitePath));
  fs.mkdirSync(dir, { recursive: true });
  db = new Database(sqlitePath);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS campaigns (
      id TEXT PRIMARY KEY,
      owner_wallet TEXT NOT NULL,
      project_name TEXT NOT NULL,
      miniapp_target_url TEXT NOT NULL,
      image_url TEXT NOT NULL,
      status TEXT NOT NULL,
      intent_id TEXT,
      tx_hash TEXT,
      billboard_id TEXT,
      room_id TEXT,
      anchor_x INTEGER,
      anchor_z INTEGER,
      expires_at_ms INTEGER,
      created_at_ms INTEGER NOT NULL,
      updated_at_ms INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS ix_campaigns_owner ON campaigns(owner_wallet);
    CREATE INDEX IF NOT EXISTS ix_campaigns_status ON campaigns(status);
    CREATE INDEX IF NOT EXISTS ix_campaigns_intent ON campaigns(intent_id);
    CREATE TABLE IF NOT EXISTS campaign_transactions (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL,
      intent_id TEXT,
      tx_hash TEXT NOT NULL UNIQUE,
      amount_luna TEXT NOT NULL,
      recorded_at_ms INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS ix_campaign_tx_campaign
      ON campaign_transactions(campaign_id, recorded_at_ms DESC);
  `);
  migrateCampaignStoreColumns(requireDb());
  backfillCampaignTransactionsFromCampaigns(requireDb());
  clearStaleCampaignPaymentIntents(requireDb());
}

let db: Database.Database | null = null;

function formatCampaignTxNimLabel(amountLuna: bigint): string {
  const whole = amountLuna / LUNA_PER_NIM;
  const frac = amountLuna % LUNA_PER_NIM;
  if (frac === 0n) return whole.toString();
  const fracStr = frac.toString().padStart(5, "0").replace(/0+$/, "");
  return whole.toString() + "." + fracStr;
}

function normalizeTxHash(v: string): string {
  return String(v || "").trim().toLowerCase();
}

function campaignTxExplorerUrl(txHash: string): string {
  const normalized = normalizeTxHash(txHash);
  if (!normalized || normalized.startsWith("admin-credit:")) return "";
  const hex = normalized.replace(/^0x/, "");
  return hex ? `https://nimiq.watch/#${hex}` : "";
}

function rowToTransactionPublic(row: CampaignTransactionRow): CampaignTransactionPublic {
  const amountLuna = BigInt(row.amount_luna);
  const txHash = normalizeTxHash(row.tx_hash);
  return {
    id: row.id,
    campaignId: row.campaign_id,
    intentId: row.intent_id,
    txHash,
    amountLuna: row.amount_luna,
    amountNimLabel: formatCampaignTxNimLabel(amountLuna),
    recordedAt: new Date(row.recorded_at_ms).toISOString(),
    explorerUrl: campaignTxExplorerUrl(txHash),
  };
}

export function recordCampaignFundingTransaction(input: {
  campaignId: string;
  intentId?: string | null;
  txHash: string;
  amountLuna: bigint;
  recordedAtMs?: number;
}): CampaignTransactionPublic | null {
  const campaignId = String(input.campaignId ?? "").trim();
  const txHash = normalizeTxHash(input.txHash);
  if (!campaignId || !txHash) return null;
  const amountLuna = input.amountLuna;
  if (amountLuna < 1n) return null;
  const now = input.recordedAtMs ?? Date.now();
  const id = randomUUID();
  const info = requireDb()
    .prepare(
      `INSERT OR IGNORE INTO campaign_transactions (
        id, campaign_id, intent_id, tx_hash, amount_luna, recorded_at_ms
      ) VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      campaignId,
      input.intentId ? String(input.intentId).trim() : null,
      txHash,
      amountLuna.toString(),
      now
    );
  if (info.changes === 0) {
    const existing = requireDb()
      .prepare(`SELECT * FROM campaign_transactions WHERE tx_hash = ?`)
      .get(txHash) as CampaignTransactionRow | undefined;
    return existing ? rowToTransactionPublic(existing) : null;
  }
  const row = requireDb()
    .prepare(`SELECT * FROM campaign_transactions WHERE id = ?`)
    .get(id) as CampaignTransactionRow;
  return row ? rowToTransactionPublic(row) : null;
}

export function listCampaignTransactions(
  campaignId: string
): CampaignTransactionPublic[] {
  const id = String(campaignId ?? "").trim();
  if (!id) return [];
  const rows = requireDb()
    .prepare(
      `SELECT * FROM campaign_transactions
       WHERE campaign_id = ?
       ORDER BY recorded_at_ms DESC`
    )
    .all(id) as CampaignTransactionRow[];
  return rows.map(rowToTransactionPublic);
}

function clearStaleCampaignPaymentIntents(database: Database.Database): void {
  database
    .prepare(
      `UPDATE campaigns SET intent_id = NULL
       WHERE intent_id IS NOT NULL
         AND tx_hash IS NOT NULL AND TRIM(tx_hash) != ''
         AND status IN ('approved', 'pending_approval', 'rejected', 'expired')`
    )
    .run();
}

export function sumCampaignFundingLuna(campaignId: string): bigint {
  const id = String(campaignId ?? "").trim();
  if (!id) return 0n;
  let total = 0n;
  for (const tx of listCampaignTransactions(id)) {
    try {
      total += BigInt(tx.amountLuna);
    } catch {
      /* skip invalid rows */
    }
  }
  return total;
}

/** Correct balances inflated by re-applying a stale payment intent as a top-up. */
export function repairInflatedCampaignBalances(): number {
  const database = requireDb();
  const statsTable = database
    .prepare(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'campaign_viewer_stats'`
    )
    .get() as { name: string } | undefined;
  if (!statsTable) return 0;

  const rows = database
    .prepare(
      `SELECT id, balance_luna FROM campaigns
       WHERE status = 'approved' AND balance_luna IS NOT NULL AND TRIM(balance_luna) != ''`
    )
    .all() as Array<{ id: string; balance_luna: string }>;

  let repaired = 0;
  const now = Date.now();
  for (const row of rows) {
    let balance = 0n;
    try {
      balance = BigInt(row.balance_luna);
    } catch {
      continue;
    }
    const funded = sumCampaignFundingLuna(row.id);
    if (funded <= 0n || balance <= funded) continue;

    const visibleRow = database
      .prepare(
        `SELECT COALESCE(SUM(visible_ms), 0) AS total_visible_ms
         FROM campaign_viewer_stats WHERE campaign_id = ?`
      )
      .get(row.id) as { total_visible_ms: number } | undefined;
    const drained = lunaDrainForVisibleMs(
      Math.max(0, Math.floor(Number(visibleRow?.total_visible_ms) || 0))
    );
    const expected = funded > drained ? funded - drained : 0n;
    database
      .prepare(
        `UPDATE campaigns SET balance_luna = ?, updated_at_ms = ?
         WHERE id = ? AND status = 'approved'`
      )
      .run(expected.toString(), now, row.id);
    repaired++;
  }
  return repaired;
}

function backfillCampaignTransactionsFromCampaigns(
  database: Database.Database
): void {
  const rows = database
    .prepare(
      `SELECT id, intent_id, tx_hash, balance_luna, updated_at_ms
       FROM campaigns
       WHERE tx_hash IS NOT NULL AND TRIM(tx_hash) != ''
         AND balance_luna IS NOT NULL AND TRIM(balance_luna) != ''`
    )
    .all() as Array<{
    id: string;
    intent_id: string | null;
    tx_hash: string;
    balance_luna: string;
    updated_at_ms: number;
  }>;
  const insert = database.prepare(
    `INSERT OR IGNORE INTO campaign_transactions (
      id, campaign_id, intent_id, tx_hash, amount_luna, recorded_at_ms
    ) VALUES (?, ?, ?, ?, ?, ?)`
  );
  for (const row of rows) {
    try {
      const luna = BigInt(row.balance_luna);
      if (luna < 1n) continue;
      insert.run(
        randomUUID(),
        row.id,
        row.intent_id,
        normalizeTxHash(row.tx_hash),
        luna.toString(),
        row.updated_at_ms
      );
    } catch {
      /* skip invalid legacy rows */
    }
  }
}

function migrateCampaignStoreColumns(database: Database.Database): void {
  const cols = database
    .prepare(`PRAGMA table_info(campaigns)`)
    .all() as Array<{ name: string }>;
  const names = new Set(cols.map((c) => c.name));
  if (!names.has("placement_mode")) {
    database.exec(
      `ALTER TABLE campaigns ADD COLUMN placement_mode TEXT NOT NULL DEFAULT 'active_carousel'`
    );
  }
  if (!names.has("display_interval_sec")) {
    database.exec(
      `ALTER TABLE campaigns ADD COLUMN display_interval_sec INTEGER NOT NULL DEFAULT 30`
    );
  }
  if (!names.has("balance_luna")) {
    database.exec(`ALTER TABLE campaigns ADD COLUMN balance_luna TEXT`);
  }
  if (!names.has("reject_note")) {
    database.exec(`ALTER TABLE campaigns ADD COLUMN reject_note TEXT`);
  }
  database
    .prepare(`UPDATE campaigns SET status = 'approved' WHERE status = 'active'`)
    .run();
}

function requireDb(): Database.Database {
  if (!db) initCampaignStore();
  return db!;
}

export function getCampaignDatabase(): Database.Database {
  return requireDb();
}

export function validateCampaignInput(input: {
  projectName?: string;
  miniappTargetUrl?: string;
  imageUrl?: string;
}): { ok: true } | { ok: false; error: string } {
  const name = String(input.projectName ?? "").trim();
  if (!name || name.length > 80) {
    return { ok: false, error: "invalid_project_name" };
  }
  const target = String(input.miniappTargetUrl ?? "").trim();
  if (!validateBillboardHttpsTarget(target)) {
    return { ok: false, error: "invalid_miniapp_target_url" };
  }
  const image = String(input.imageUrl ?? "").trim();
  if (!isAllowedBillboardImageUrl(image)) {
    return { ok: false, error: "invalid_image_url" };
  }
  return { ok: true };
}

export function createCampaign(
  ownerWallet: string,
  input: {
    projectName: string;
    miniappTargetUrl: string;
    imageUrl: string;
    placementMode?: CampaignPlacementMode;
    displayIntervalSec?: number;
  }
): CampaignPublic | null {
  const owner = normalizeWallet(ownerWallet);
  if (!owner) return null;
  const v = validateCampaignInput(input);
  if (!v.ok) return null;
  const placementMode =
    input.placementMode === "dedicated_anchor"
      ? "dedicated_anchor"
      : CAMPAIGN_PLACEMENT_ACTIVE_CAROUSEL;
  if (placementMode === "dedicated_anchor") return null;
  const displayIntervalSec = isCampaignSlideDwellSec(
    Number(input.displayIntervalSec ?? 10)
  )
    ? Number(input.displayIntervalSec)
    : 30;
  const now = Date.now();
  const id = randomUUID();
  const row: CampaignRow = {
    id,
    owner_wallet: owner,
    project_name: String(input.projectName).trim(),
    miniapp_target_url: String(input.miniappTargetUrl).trim(),
    image_url: String(input.imageUrl).trim(),
    status: "draft",
    intent_id: null,
    tx_hash: null,
    billboard_id: null,
    room_id: null,
    anchor_x: null,
    anchor_z: null,
    expires_at_ms: null,
    placement_mode: placementMode,
    display_interval_sec: displayIntervalSec,
    balance_luna: null,
    reject_note: null,
    created_at_ms: now,
    updated_at_ms: now,
  };
  requireDb()
    .prepare(
      `INSERT INTO campaigns (
        id, owner_wallet, project_name, miniapp_target_url, image_url, status,
        intent_id, tx_hash, billboard_id, room_id, anchor_x, anchor_z,
        expires_at_ms, placement_mode, display_interval_sec, balance_luna,
        created_at_ms, updated_at_ms
      ) VALUES (
        @id, @owner_wallet, @project_name, @miniapp_target_url, @image_url, @status,
        @intent_id, @tx_hash, @billboard_id, @room_id, @anchor_x, @anchor_z,
        @expires_at_ms, @placement_mode, @display_interval_sec, @balance_luna,
        @created_at_ms, @updated_at_ms
      )`
    )
    .run(row);
  return rowToPublic(row);
}

export function listCampaignsForOwner(ownerWallet: string): CampaignPublic[] {
  const owner = normalizeWallet(ownerWallet);
  const rows = requireDb()
    .prepare(
      `SELECT * FROM campaigns WHERE owner_wallet = ? ORDER BY created_at_ms DESC`
    )
    .all(owner) as CampaignRow[];
  return rows.map(rowToPublic);
}

export function getCampaignById(id: string): CampaignPublic | null {
  const row = requireDb()
    .prepare(`SELECT * FROM campaigns WHERE id = ?`)
    .get(id.trim()) as CampaignRow | undefined;
  return row ? rowToPublic(row) : null;
}

export function getCampaignForOwner(
  id: string,
  ownerWallet: string
): CampaignPublic | null {
  const row = requireDb()
    .prepare(`SELECT * FROM campaigns WHERE id = ? AND owner_wallet = ?`)
    .get(id.trim(), normalizeWallet(ownerWallet)) as CampaignRow | undefined;
  return row ? rowToPublic(row) : null;
}

const CAMPAIGN_DWELL_EDITABLE_STATUSES: CampaignStatus[] = [
  "pending_payment",
  "pending_approval",
  "approved",
  "expired",
];

/** Owner may change on-screen dwell after funding; full draft edits stay in `updateCampaignDraft`. */
export function updateCampaignDisplayInterval(
  id: string,
  ownerWallet: string,
  displayIntervalSec: number
): CampaignPublic | null {
  const existing = getCampaignForOwner(id, ownerWallet);
  if (!existing || !CAMPAIGN_DWELL_EDITABLE_STATUSES.includes(existing.status)) {
    return null;
  }
  if (!isCampaignSlideDwellSec(displayIntervalSec)) return null;
  const now = Date.now();
  requireDb()
    .prepare(
      `UPDATE campaigns SET display_interval_sec = ?, updated_at_ms = ?
       WHERE id = ? AND owner_wallet = ?`
    )
    .run(
      displayIntervalSec,
      now,
      id.trim(),
      normalizeWallet(ownerWallet)
    );
  return getCampaignForOwner(id, ownerWallet);
}

export function updateCampaignDraft(
  id: string,
  ownerWallet: string,
  patch: {
    projectName?: string;
    miniappTargetUrl?: string;
    imageUrl?: string;
    displayIntervalSec?: number;
  }
): CampaignPublic | null {
  const existing = getCampaignForOwner(id, ownerWallet);
  if (!existing || existing.status !== "draft") return null;
  const next = {
    projectName: patch.projectName ?? existing.projectName,
    miniappTargetUrl: patch.miniappTargetUrl ?? existing.miniappTargetUrl,
    imageUrl: patch.imageUrl ?? existing.imageUrl,
  };
  const v = validateCampaignInput(next);
  if (!v.ok) return null;
  let displayIntervalSec = existing.displayIntervalSec;
  if (
    patch.displayIntervalSec !== undefined &&
    isCampaignSlideDwellSec(patch.displayIntervalSec)
  ) {
    displayIntervalSec = patch.displayIntervalSec;
  }
  const now = Date.now();
  requireDb()
    .prepare(
      `UPDATE campaigns SET
        project_name = ?, miniapp_target_url = ?, image_url = ?,
        display_interval_sec = ?, updated_at_ms = ?
       WHERE id = ? AND owner_wallet = ? AND status = 'draft'`
    )
    .run(
      next.projectName.trim(),
      next.miniappTargetUrl.trim(),
      next.imageUrl.trim(),
      displayIntervalSec,
      now,
      id.trim(),
      normalizeWallet(ownerWallet)
    );
  return getCampaignForOwner(id, ownerWallet);
}

export function setCampaignPendingPayment(
  id: string,
  ownerWallet: string,
  intentId: string
): CampaignPublic | null {
  const existing = getCampaignForOwner(id, ownerWallet);
  if (
    !existing ||
    (existing.status !== "draft" &&
      existing.status !== "pending_payment" &&
      existing.status !== "expired")
  ) {
    return null;
  }
  const now = Date.now();
  requireDb()
    .prepare(
      `UPDATE campaigns SET status = 'pending_payment', intent_id = ?, updated_at_ms = ?
       WHERE id = ? AND owner_wallet = ?`
    )
    .run(intentId.trim(), now, id.trim(), normalizeWallet(ownerWallet));
  return getCampaignForOwner(id, ownerWallet);
}

/** Attach a payment intent for topping up an approved campaign (stays live). */
export function setCampaignTopUpPayment(
  id: string,
  ownerWallet: string,
  intentId: string
): CampaignPublic | null {
  const existing = getCampaignForOwner(id, ownerWallet);
  if (!existing || existing.status !== "approved") return null;
  const now = Date.now();
  const info = requireDb()
    .prepare(
      `UPDATE campaigns SET intent_id = ?, updated_at_ms = ?
       WHERE id = ? AND owner_wallet = ? AND status = 'approved'`
    )
    .run(intentId.trim(), now, id.trim(), normalizeWallet(ownerWallet));
  if (info.changes === 0) return null;
  return getCampaignForOwner(id, ownerWallet);
}

export function markCampaignPendingApproval(
  id: string,
  txHash: string,
  balanceLuna: bigint
): CampaignPublic | null {
  const now = Date.now();
  const info = requireDb()
    .prepare(
      `UPDATE campaigns SET status = 'pending_approval', tx_hash = ?,
        balance_luna = ?, intent_id = NULL, updated_at_ms = ?
       WHERE id = ? AND status = 'pending_payment'`
    )
    .run(txHash.trim(), balanceLuna.toString(), now, id.trim());
  if (info.changes === 0) return null;
  const campaign = getCampaignById(id);
  if (campaign) {
    recordCampaignFundingTransaction({
      campaignId: campaign.id,
      intentId: campaign.intentId,
      txHash,
      amountLuna: balanceLuna,
      recordedAtMs: now,
    });
  }
  return campaign;
}

/** Credits additional prepaid balance on an already-approved campaign. */
export function applyCampaignTopUpPayment(
  id: string,
  txHash: string,
  topUpLuna: bigint
): CampaignPublic | null {
  const campaignId = String(id ?? "").trim();
  const hash = normalizeTxHash(txHash);
  if (!campaignId || !hash || topUpLuna < 1n) return null;

  const dup = requireDb()
    .prepare(`SELECT 1 FROM campaign_transactions WHERE tx_hash = ?`)
    .get(hash) as { 1: number } | undefined;
  if (dup) {
    const now = Date.now();
    requireDb()
      .prepare(
        `UPDATE campaigns SET intent_id = NULL, updated_at_ms = ?
         WHERE id = ? AND status = 'approved'`
      )
      .run(now, campaignId);
    return getCampaignById(campaignId);
  }

  const row = requireDb()
    .prepare(`SELECT status, balance_luna, intent_id FROM campaigns WHERE id = ?`)
    .get(campaignId) as
    | { status: string; balance_luna: string | null; intent_id: string | null }
    | undefined;
  if (!row || row.status !== "approved") return null;

  let balance = 0n;
  try {
    balance = BigInt(row.balance_luna ?? 0);
  } catch {
    balance = 0n;
  }
  const newBalance = balance + topUpLuna;
  const now = Date.now();
  const info = requireDb()
    .prepare(
      `UPDATE campaigns SET
        balance_luna = ?,
        tx_hash = ?,
        intent_id = NULL,
        updated_at_ms = ?
       WHERE id = ? AND status = 'approved'`
    )
    .run(newBalance.toString(), hash, now, campaignId);
  if (info.changes === 0) return null;

  recordCampaignFundingTransaction({
    campaignId,
    intentId: row.intent_id,
    txHash: hash,
    amountLuna: topUpLuna,
    recordedAtMs: now,
  });
  return getCampaignById(campaignId);
}

export function listCampaignsPendingApproval(): CampaignPublic[] {
  const rows = requireDb()
    .prepare(
      `SELECT * FROM campaigns WHERE status = 'pending_approval' ORDER BY updated_at_ms ASC`
    )
    .all() as CampaignRow[];
  return rows.map(rowToPublic);
}

export function listApprovedCampaigns(): CampaignPublic[] {
  const rows = requireDb()
    .prepare(
      `SELECT * FROM campaigns WHERE status = 'approved' ORDER BY project_name ASC`
    )
    .all() as CampaignRow[];
  return rows.map(rowToPublic);
}

export function listExpiredCampaigns(): CampaignPublic[] {
  const rows = requireDb()
    .prepare(
      `SELECT * FROM campaigns WHERE status = 'expired' ORDER BY updated_at_ms DESC`
    )
    .all() as CampaignRow[];
  return rows.map(rowToPublic);
}

/** Draft or abandoned payment — never reached pending approval. */
export function listUnfundedCampaigns(): CampaignPublic[] {
  const rows = requireDb()
    .prepare(
      `SELECT * FROM campaigns
       WHERE status IN ('draft', 'pending_payment')
       ORDER BY updated_at_ms DESC`
    )
    .all() as CampaignRow[];
  return rows.map(rowToPublic);
}

export function approveCampaign(
  id: string,
  expiresAtMs: number | null = null
): CampaignPublic | null {
  const now = Date.now();
  const info = requireDb()
    .prepare(
      `UPDATE campaigns SET
        status = 'approved',
        expires_at_ms = ?,
        intent_id = NULL,
        updated_at_ms = ?
       WHERE id = ? AND status = 'pending_approval'`
    )
    .run(expiresAtMs, now, id.trim());
  if (info.changes === 0) return null;
  return getCampaignById(id);
}

export function rejectCampaign(
  id: string,
  note?: string
): CampaignPublic | null {
  const now = Date.now();
  const rejectNote = String(note ?? "").trim().slice(0, 500) || null;
  const info = requireDb()
    .prepare(
      `UPDATE campaigns SET
        status = 'rejected',
        reject_note = ?,
        updated_at_ms = ?
       WHERE id = ? AND status = 'pending_approval'`
    )
    .run(rejectNote, now, id.trim());
  if (info.changes === 0) return null;
  return getCampaignById(id);
}

const ADMIN_EDITABLE_CAMPAIGN_STATUSES: CampaignStatus[] = [
  "draft",
  "pending_payment",
  "pending_approval",
  "approved",
  "expired",
];

/** Admin may change display name and target URL (not rejected campaigns). */
export function adminUpdateCampaignFields(
  id: string,
  patch: { projectName?: string; miniappTargetUrl?: string }
): CampaignPublic | null {
  const campaignId = String(id ?? "").trim();
  if (!campaignId) return null;
  const existing = getCampaignById(campaignId);
  if (!existing || !ADMIN_EDITABLE_CAMPAIGN_STATUSES.includes(existing.status)) {
    return null;
  }
  const nextName =
    patch.projectName !== undefined
      ? String(patch.projectName).trim()
      : existing.projectName;
  const nextUrl =
    patch.miniappTargetUrl !== undefined
      ? String(patch.miniappTargetUrl).trim()
      : existing.miniappTargetUrl;
  if (!nextName || nextName.length > 80) return null;
  if (!validateBillboardHttpsTarget(nextUrl)) return null;
  const now = Date.now();
  const info = requireDb()
    .prepare(
      `UPDATE campaigns SET
        project_name = ?,
        miniapp_target_url = ?,
        updated_at_ms = ?
       WHERE id = ? AND status IN ('draft', 'pending_payment', 'pending_approval', 'approved', 'expired')`
    )
    .run(nextName, nextUrl, now, campaignId);
  if (info.changes === 0) return null;
  return getCampaignById(campaignId);
}

const ADMIN_CREDIT_CAMPAIGN_STATUSES: CampaignStatus[] = [
  "pending_approval",
  "approved",
  "expired",
];

/** Grants prepaid bonus balance; records a synthetic admin-credit ledger row. */
export function grantCampaignAdminCredit(
  id: string,
  amountLuna: bigint
): CampaignPublic | null {
  const campaignId = String(id ?? "").trim();
  if (!campaignId || amountLuna < 1n) return null;

  const row = requireDb()
    .prepare(`SELECT status, balance_luna FROM campaigns WHERE id = ?`)
    .get(campaignId) as
    | { status: CampaignStatus; balance_luna: string | null }
    | undefined;
  if (!row || !ADMIN_CREDIT_CAMPAIGN_STATUSES.includes(row.status)) return null;

  let balance = 0n;
  try {
    balance = BigInt(row.balance_luna ?? 0);
  } catch {
    balance = 0n;
  }
  const newBalance = balance + amountLuna;
  const newStatus = row.status === "expired" ? "approved" : row.status;
  const now = Date.now();
  const txHash = `admin-credit:${randomUUID()}`;

  const info = requireDb()
    .prepare(
      `UPDATE campaigns SET
        balance_luna = ?,
        status = ?,
        updated_at_ms = ?
       WHERE id = ? AND status IN ('pending_approval', 'approved', 'expired')`
    )
    .run(newBalance.toString(), newStatus, now, campaignId);
  if (info.changes === 0) return null;

  recordCampaignFundingTransaction({
    campaignId,
    intentId: null,
    txHash,
    amountLuna,
    recordedAtMs: now,
  });
  return getCampaignById(campaignId);
}

/** @deprecated use approveCampaign — kept for migration references */
export function activateCampaign(
  id: string,
  patch: {
    billboardId: string;
    roomId: string;
    anchorX: number;
    anchorZ: number;
    expiresAtMs: number;
    txHash: string;
  }
): CampaignPublic | null {
  const now = Date.now();
  const info = requireDb()
    .prepare(
      `UPDATE campaigns SET
        status = 'active',
        billboard_id = ?,
        room_id = ?,
        anchor_x = ?,
        anchor_z = ?,
        expires_at_ms = ?,
        tx_hash = ?,
        updated_at_ms = ?
       WHERE id = ? AND status IN ('pending_approval')`
    )
    .run(
      patch.billboardId,
      patch.roomId,
      patch.anchorX,
      patch.anchorZ,
      patch.expiresAtMs,
      patch.txHash.trim(),
      now,
      id.trim()
    );
  if (info.changes === 0) return null;
  return getCampaignById(id);
}

export type CampaignVisibilityDebitResult = "debited" | "expired" | "skipped";

/** Debits prepaid balance from verified on-screen milliseconds (approved campaigns only). */
export function debitCampaignVisibilityLuna(
  campaignId: string,
  visibleMs: number
): CampaignVisibilityDebitResult {
  const id = String(campaignId ?? "").trim();
  if (!id) return "skipped";
  const ms = Math.max(0, Math.floor(Number(visibleMs) || 0));
  if (ms < 1) return "skipped";
  const drain = lunaDrainForVisibleMs(ms);
  if (drain <= 0n) return "skipped";

  const row = requireDb()
    .prepare(`SELECT status, balance_luna FROM campaigns WHERE id = ?`)
    .get(id) as { status: string; balance_luna: string | null } | undefined;
  if (!row || row.status !== "approved") return "skipped";

  let balance = 0n;
  try {
    balance = BigInt(row.balance_luna ?? 0);
  } catch {
    return "skipped";
  }
  if (balance <= 0n) return "skipped";

  const now = Date.now();
  const newBalance = drain >= balance ? 0n : balance - drain;
  if (newBalance === 0n) {
    const info = requireDb()
      .prepare(
        `UPDATE campaigns SET
          status = 'expired',
          balance_luna = '0',
          updated_at_ms = ?
         WHERE id = ? AND status = 'approved'`
      )
      .run(now, id);
    return info.changes > 0 ? "expired" : "skipped";
  }

  const info = requireDb()
    .prepare(
      `UPDATE campaigns SET balance_luna = ?, updated_at_ms = ?
       WHERE id = ? AND status = 'approved'`
    )
    .run(newBalance.toString(), now, id);
  return info.changes > 0 ? "debited" : "skipped";
}

export function expireCampaign(id: string): CampaignPublic | null {
  const now = Date.now();
  const info = requireDb()
    .prepare(
      `UPDATE campaigns SET status = 'expired', updated_at_ms = ?
       WHERE id = ? AND status = 'approved'`
    )
    .run(now, id.trim());
  if (info.changes === 0) return null;
  return getCampaignById(id);
}

export function listCampaignsDueForExpiry(nowMs: number): CampaignPublic[] {
  const rows = requireDb()
    .prepare(
      `SELECT * FROM campaigns
       WHERE status = 'approved' AND expires_at_ms IS NOT NULL AND expires_at_ms <= ?`
    )
    .all(nowMs) as CampaignRow[];
  return rows.map(rowToPublic);
}

/** @deprecated rotation sets replace per-slot occupancy */
export function listActiveCarouselCampaigns(): CampaignPublic[] {
  const rows = requireDb()
    .prepare(
      `SELECT * FROM campaigns
       WHERE status = 'approved' AND placement_mode = ?`
    )
    .all(CAMPAIGN_PLACEMENT_ACTIVE_CAROUSEL) as CampaignRow[];
  return rows.map(rowToPublic);
}

/** @deprecated rotation sets replace fixed Hub slot tracking */
export function listOccupiedCompetitionSlots(): Array<{
  roomId: string;
  anchorX: number;
  anchorZ: number;
}> {
  const rows = requireDb()
    .prepare(
      `SELECT room_id, anchor_x, anchor_z FROM campaigns
       WHERE status = 'approved' AND room_id IS NOT NULL
         AND anchor_x IS NOT NULL AND anchor_z IS NOT NULL`
    )
    .all() as Array<{
    room_id: string;
    anchor_x: number;
    anchor_z: number;
  }>;
  return rows.map((r) => ({
    roomId: r.room_id,
    anchorX: r.anchor_x,
    anchorZ: r.anchor_z,
  }));
}

export function findCampaignByIntentId(intentId: string): CampaignPublic | null {
  const row = requireDb()
    .prepare(`SELECT * FROM campaigns WHERE intent_id = ?`)
    .get(intentId.trim()) as CampaignRow | undefined;
  return row ? rowToPublic(row) : null;
}
