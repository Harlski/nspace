/**
 * Durable Return Walk Invoices and Return Budget (SQLite).
 */

import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { compactWalletKey } from "../walletAddresses.js";
import {
  INVOICE_ID_PREFIX,
  INVOICE_TTL_MS,
  RETURN_WALK_DEPOSIT_LUNA,
  RETURN_GOLD_LUNA,
  type InvoiceStatus,
} from "./constants.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function storePath(): string {
  const override = process.env.RETURN_WALK_STORE_FILE?.trim();
  if (override) return path.resolve(override);
  return path.join(__dirname, "..", "..", "data", "return-walk.sqlite");
}

export type InvoiceRow = {
  invoiceId: string;
  residentWallet: string;
  toAddress: string;
  amountLuna: string;
  status: InvoiceStatus;
  returnBudgetLuna: string;
  reservedLuna: string;
  txHash: string | null;
  createdAtMs: number;
  expiresAtMs: number;
  creditedAtMs: number | null;
};

let dbs = new Map<string, Database.Database>();

function ensureDb(): Database.Database {
  const file = storePath();
  const existing = dbs.get(file);
  if (existing) return existing;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const opened = new Database(file);
  opened.pragma("journal_mode = WAL");
  opened.exec(`
    CREATE TABLE IF NOT EXISTS invoices (
      invoice_id TEXT PRIMARY KEY,
      resident_wallet TEXT NOT NULL,
      to_address TEXT NOT NULL,
      amount_luna TEXT NOT NULL,
      status TEXT NOT NULL,
      return_budget_luna TEXT NOT NULL,
      reserved_luna TEXT NOT NULL,
      tx_hash TEXT,
      created_at_ms INTEGER NOT NULL,
      expires_at_ms INTEGER NOT NULL,
      credited_at_ms INTEGER
    );
    CREATE INDEX IF NOT EXISTS invoices_resident_status
      ON invoices (resident_wallet, status);
    CREATE TABLE IF NOT EXISTS reservations (
      id TEXT PRIMARY KEY,
      invoice_id TEXT NOT NULL,
      room_id TEXT NOT NULL,
      tile_key TEXT NOT NULL,
      amount_luna TEXT NOT NULL,
      created_at_ms INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS reservations_tile
      ON reservations (room_id, tile_key);
  `);
  dbs.set(file, opened);
  return opened;
}

function newInvoiceId(): string {
  return `${INVOICE_ID_PREFIX}${randomBytes(8).toString("hex")}`;
}

function rowFromDb(r: Record<string, unknown>): InvoiceRow {
  return {
    invoiceId: String(r.invoice_id),
    residentWallet: String(r.resident_wallet),
    toAddress: String(r.to_address),
    amountLuna: String(r.amount_luna),
    status: String(r.status) as InvoiceStatus,
    returnBudgetLuna: String(r.return_budget_luna),
    reservedLuna: String(r.reserved_luna),
    txHash: r.tx_hash == null ? null : String(r.tx_hash),
    createdAtMs: Number(r.created_at_ms),
    expiresAtMs: Number(r.expires_at_ms),
    creditedAtMs: r.credited_at_ms == null ? null : Number(r.credited_at_ms),
  };
}

export function expireUnpaidInvoices(nowMs: number = Date.now()): number {
  const d = ensureDb();
  const info = d
    .prepare(
      `UPDATE invoices SET status = 'expired'
       WHERE status = 'unpaid' AND expires_at_ms <= ?`
    )
    .run(nowMs);
  return info.changes;
}

export function findUnpaidInvoice(
  residentWallet: string,
  nowMs: number = Date.now()
): InvoiceRow | null {
  expireUnpaidInvoices(nowMs);
  const d = ensureDb();
  const wallet = compactWalletKey(residentWallet);
  const r = d
    .prepare(
      `SELECT * FROM invoices WHERE resident_wallet = ? AND status = 'unpaid'
       ORDER BY created_at_ms DESC LIMIT 1`
    )
    .get(wallet) as Record<string, unknown> | undefined;
  return r ? rowFromDb(r) : null;
}

export function getInvoice(invoiceId: string, nowMs: number = Date.now()): InvoiceRow | null {
  expireUnpaidInvoices(nowMs);
  const d = ensureDb();
  const r = d
    .prepare(`SELECT * FROM invoices WHERE invoice_id = ?`)
    .get(invoiceId) as Record<string, unknown> | undefined;
  return r ? rowFromDb(r) : null;
}

export function createUnpaidInvoice(opts: {
  residentWallet: string;
  toAddress: string;
  nowMs?: number;
}): InvoiceRow | { error: "unpaid_exists" } {
  const nowMs = opts.nowMs ?? Date.now();
  expireUnpaidInvoices(nowMs);
  const existing = findUnpaidInvoice(opts.residentWallet, nowMs);
  if (existing) return { error: "unpaid_exists" };
  const d = ensureDb();
  const row: InvoiceRow = {
    invoiceId: newInvoiceId(),
    residentWallet: compactWalletKey(opts.residentWallet),
    toAddress: opts.toAddress,
    amountLuna: RETURN_WALK_DEPOSIT_LUNA.toString(),
    status: "unpaid",
    returnBudgetLuna: "0",
    reservedLuna: "0",
    txHash: null,
    createdAtMs: nowMs,
    expiresAtMs: nowMs + INVOICE_TTL_MS,
    creditedAtMs: null,
  };
  d.prepare(
    `INSERT INTO invoices (
      invoice_id, resident_wallet, to_address, amount_luna, status,
      return_budget_luna, reserved_luna, tx_hash, created_at_ms,
      expires_at_ms, credited_at_ms
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    row.invoiceId,
    row.residentWallet,
    row.toAddress,
    row.amountLuna,
    row.status,
    row.returnBudgetLuna,
    row.reservedLuna,
    row.txHash,
    row.createdAtMs,
    row.expiresAtMs,
    row.creditedAtMs
  );
  return row;
}

export function creditInvoice(opts: {
  invoiceId: string;
  txHash: string;
  nowMs?: number;
}): InvoiceRow | { error: "not_found" | "not_unpaid" } {
  const nowMs = opts.nowMs ?? Date.now();
  expireUnpaidInvoices(nowMs);
  const d = ensureDb();
  const current = getInvoice(opts.invoiceId, nowMs);
  if (!current) return { error: "not_found" };
  if (current.status === "credited") return current;
  if (current.status !== "unpaid") return { error: "not_unpaid" };
  d.prepare(
    `UPDATE invoices SET
       status = 'credited',
       return_budget_luna = ?,
       tx_hash = ?,
       credited_at_ms = ?
     WHERE invoice_id = ? AND status = 'unpaid'`
  ).run(
    RETURN_WALK_DEPOSIT_LUNA.toString(),
    opts.txHash,
    nowMs,
    opts.invoiceId
  );
  return getInvoice(opts.invoiceId, nowMs) ?? { error: "not_found" };
}

export function findInvoiceByTxHash(txHash: string): InvoiceRow | null {
  const d = ensureDb();
  const r = d
    .prepare(`SELECT * FROM invoices WHERE tx_hash = ?`)
    .get(txHash) as Record<string, unknown> | undefined;
  return r ? rowFromDb(r) : null;
}

export function listUnpaidInvoices(nowMs: number = Date.now()): InvoiceRow[] {
  expireUnpaidInvoices(nowMs);
  const d = ensureDb();
  const rows = d
    .prepare(`SELECT * FROM invoices WHERE status = 'unpaid'`)
    .all() as Record<string, unknown>[];
  return rows.map(rowFromDb);
}

/** Remaining unreserved Return Budget across credited Invoices (luna). */
export function remainingReturnBudgetLuna(): bigint {
  expireUnpaidInvoices();
  const d = ensureDb();
  const rows = d
    .prepare(
      `SELECT return_budget_luna FROM invoices WHERE status = 'credited'`
    )
    .all() as Array<{ return_budget_luna: string }>;
  let total = 0n;
  for (const r of rows) total += BigInt(r.return_budget_luna);
  return total;
}

export function hasOpenReturnWalkBudget(): boolean {
  return remainingReturnBudgetLuna() >= RETURN_GOLD_LUNA;
}

/**
 * Reserve 1 NIM of Return Budget for an Upgrade (FIFO oldest credited Invoice).
 * Returns false when remaining Return Budget is below 1 NIM or the tile is already reserved.
 */
export function reserveReturnGold(opts: {
  roomId: string;
  tileKey: string;
  nowMs?: number;
}): boolean {
  const nowMs = opts.nowMs ?? Date.now();
  const d = ensureDb();
  const reserve = d.transaction(() => {
    const existing = d
      .prepare(
        `SELECT id FROM reservations WHERE room_id = ? AND tile_key = ?`
      )
      .get(opts.roomId, opts.tileKey);
    if (existing) return false;
    const inv = d
      .prepare(
        `SELECT * FROM invoices
         WHERE status = 'credited' AND CAST(return_budget_luna AS INTEGER) >= ?
         ORDER BY credited_at_ms ASC, created_at_ms ASC
         LIMIT 1`
      )
      .get(Number(RETURN_GOLD_LUNA)) as Record<string, unknown> | undefined;
    if (!inv) return false;
    const invoiceId = String(inv.invoice_id);
    const budget = BigInt(String(inv.return_budget_luna));
    const reserved = BigInt(String(inv.reserved_luna));
    if (budget < RETURN_GOLD_LUNA) return false;
    d.prepare(
      `UPDATE invoices SET return_budget_luna = ?, reserved_luna = ?
       WHERE invoice_id = ?`
    ).run(
      (budget - RETURN_GOLD_LUNA).toString(),
      (reserved + RETURN_GOLD_LUNA).toString(),
      invoiceId
    );
    d.prepare(
      `INSERT INTO reservations (id, invoice_id, room_id, tile_key, amount_luna, created_at_ms)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      randomBytes(8).toString("hex"),
      invoiceId,
      opts.roomId,
      opts.tileKey,
      RETURN_GOLD_LUNA.toString(),
      nowMs
    );
    return true;
  });
  return reserve();
}

/**
 * Undo an Upgrade reservation when convert-to-Return-Gold fails.
 * Restores Return Budget on the Invoice.
 */
export function releaseReturnGoldReservation(opts: {
  roomId: string;
  tileKey: string;
}): boolean {
  const d = ensureDb();
  const release = d.transaction(() => {
    const row = d
      .prepare(
        `SELECT * FROM reservations WHERE room_id = ? AND tile_key = ?`
      )
      .get(opts.roomId, opts.tileKey) as Record<string, unknown> | undefined;
    if (!row) return false;
    const invoiceId = String(row.invoice_id);
    const amount = BigInt(String(row.amount_luna));
    const inv = d
      .prepare(
        `SELECT return_budget_luna, reserved_luna FROM invoices WHERE invoice_id = ?`
      )
      .get(invoiceId) as
      | { return_budget_luna: string; reserved_luna: string }
      | undefined;
    if (inv) {
      const nextReserved =
        BigInt(inv.reserved_luna) > amount
          ? BigInt(inv.reserved_luna) - amount
          : 0n;
      d.prepare(
        `UPDATE invoices SET return_budget_luna = ?, reserved_luna = ?
         WHERE invoice_id = ?`
      ).run(
        (BigInt(inv.return_budget_luna) + amount).toString(),
        nextReserved.toString(),
        invoiceId
      );
    }
    d.prepare(
      `DELETE FROM reservations WHERE room_id = ? AND tile_key = ?`
    ).run(opts.roomId, opts.tileKey);
    return true;
  });
  return release();
}

/** Spend a reservation on a successful Return Gold claim (does not restore Return Budget). */
export function spendReturnGoldReservation(opts: {
  roomId: string;
  tileKey: string;
}): boolean {
  const d = ensureDb();
  const spend = d.transaction(() => {
    const row = d
      .prepare(
        `SELECT * FROM reservations WHERE room_id = ? AND tile_key = ?`
      )
      .get(opts.roomId, opts.tileKey) as Record<string, unknown> | undefined;
    if (!row) return false;
    const invoiceId = String(row.invoice_id);
    const inv = d
      .prepare(`SELECT reserved_luna FROM invoices WHERE invoice_id = ?`)
      .get(invoiceId) as { reserved_luna: string } | undefined;
    if (inv) {
      const reserved = BigInt(inv.reserved_luna);
      const next = reserved > RETURN_GOLD_LUNA ? reserved - RETURN_GOLD_LUNA : 0n;
      d.prepare(`UPDATE invoices SET reserved_luna = ? WHERE invoice_id = ?`).run(
        next.toString(),
        invoiceId
      );
    }
    d.prepare(`DELETE FROM reservations WHERE room_id = ? AND tile_key = ?`).run(
      opts.roomId,
      opts.tileKey
    );
    return true;
  });
  return spend();
}

export function closeReturnWalkStore(): void {
  for (const opened of dbs.values()) opened.close();
  dbs = new Map();
}

/** Test-only: close so the next call reopens (honors RETURN_WALK_STORE_FILE). */
export function __resetReturnWalkStoreForTests(): void {
  const file = storePath();
  const opened = dbs.get(file);
  if (opened) {
    opened.close();
    dbs.delete(file);
  }
  try {
    for (const suffix of ["", "-wal", "-shm"]) {
      const p = `${file}${suffix}`;
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
  } catch {
    /* ignore */
  }
}
