import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { appendAdminSystemLog } from "./adminSystemMonitor.js";
import { shouldHoldMiningPayoutForBannedWallet } from "./payoutMiningGate.js";
import type { PayIntent } from "./payoutServiceClient.js";
import {
  deliverPayIntentToService,
  type PayIntentDeliverer,
  type PayIntentPayload,
} from "./payoutServiceClient.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function outboxDir(): string {
  return process.env.PAYOUT_OUTBOX_DIR
    ? path.resolve(process.env.PAYOUT_OUTBOX_DIR)
    : path.join(__dirname, "..", "data", "payout-outbox");
}

function outboxFile(): string {
  return path.join(outboxDir(), "outbox.jsonl");
}

/** Legacy full-array file (rewrote multi-MB on every claim — caused event-loop stalls). */
function deliveredLegacyFile(): string {
  return path.join(outboxDir(), "delivered-claim-ids.json");
}

/** Append-only one claim id per line. */
function deliveredJsonlFile(): string {
  return path.join(outboxDir(), "delivered-claim-ids.jsonl");
}

type OutboxRecord = PayIntent & { enqueuedAt: number };

const deliveredClaimIds = new Set<string>();
/** Undelivered intents kept in memory so the 2s loop does not re-parse the JSONL every tick. */
let pendingRecords: OutboxRecord[] = [];
let deliveryTimer: ReturnType<typeof setTimeout> | null = null;
let deliveryLoopActive = false;
let delivering = false;
let deliverer: PayIntentDeliverer = deliverPayIntentToService;

const DELIVERY_INTERVAL_MS = Math.max(
  500,
  Number(process.env.PAYOUT_OUTBOX_DELIVERY_INTERVAL_MS ?? 2000)
);

/** Log when a sync outbox parse exceeds this (ms); 0 disables. */
const OUTBOX_PARSE_WARN_MS = Math.max(
  0,
  Number(process.env.PAYOUT_OUTBOX_PARSE_WARN_MS ?? 50)
);

function ensureOutboxDir(): void {
  fs.mkdirSync(outboxDir(), { recursive: true });
}

function rewriteDeliveredJsonlFromSet(): void {
  const dest = deliveredJsonlFile();
  const tmp = `${dest}.${process.pid}.tmp`;
  const body =
    deliveredClaimIds.size === 0
      ? ""
      : `${[...deliveredClaimIds].join("\n")}\n`;
  fs.writeFileSync(tmp, body, "utf8");
  fs.renameSync(tmp, dest);
}

function loadIdsFromJsonl(filePath: string, into: Set<string>): void {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, "utf8");
  for (const line of raw.split("\n")) {
    const id = line.trim();
    if (id) into.add(id);
  }
}

function loadIdsFromLegacyJsonArray(filePath: string, into: Set<string>): void {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) return;
  for (const id of parsed) {
    if (typeof id === "string" && id.trim()) {
      into.add(id.trim());
    }
  }
}

function loadDeliveredClaimIds(): void {
  deliveredClaimIds.clear();
  try {
    ensureOutboxDir();
    const jsonlPath = deliveredJsonlFile();
    const legacyPath = deliveredLegacyFile();
    loadIdsFromJsonl(jsonlPath, deliveredClaimIds);
    if (fs.existsSync(legacyPath)) {
      loadIdsFromLegacyJsonArray(legacyPath, deliveredClaimIds);
      rewriteDeliveredJsonlFromSet();
      const bak = `${legacyPath}.pre-jsonl.bak`;
      fs.renameSync(legacyPath, bak);
      console.log(
        `[payout-outbox] Migrated delivered-claim-ids.json → .jsonl (${deliveredClaimIds.size} ids); legacy at ${path.basename(bak)}`
      );
    }
  } catch (e) {
    console.error("[payout-outbox] Failed to load delivered claim ids:", e);
  }
}

/** Append a single id — never rewrite the full set (was multi-MB sync I/O per claim). */
function appendDeliveredClaimId(claimId: string): void {
  try {
    ensureOutboxDir();
    fs.appendFileSync(deliveredJsonlFile(), `${claimId}\n`, "utf8");
  } catch (e) {
    console.error("[payout-outbox] Failed to append delivered claim id:", e);
  }
}

function recordToLine(record: OutboxRecord): string {
  return JSON.stringify({
    ...record,
    amountLuna: record.amountLuna?.toString(),
  });
}

function parseOutboxLine(line: string): OutboxRecord | null {
  try {
    const o = JSON.parse(line) as OutboxRecord & { amountLuna?: string };
    if (typeof o.claimId !== "string" || !o.claimId.trim()) return null;
    if (typeof o.recipientAddress !== "string") return null;
    if (typeof o.roomId !== "string") return null;
    if (typeof o.tileKey !== "string") return null;
    return {
      claimId: o.claimId,
      recipientAddress: o.recipientAddress,
      amountLuna:
        o.amountLuna !== undefined
          ? typeof o.amountLuna === "bigint"
            ? o.amountLuna
            : BigInt(String(o.amountLuna))
          : undefined,
      roomId: o.roomId,
      tileKey: o.tileKey,
      txMessage: o.txMessage,
      enqueuedAt: typeof o.enqueuedAt === "number" ? o.enqueuedAt : 0,
    };
  } catch {
    return null;
  }
}

function readOutboxRecords(): OutboxRecord[] {
  try {
    const filePath = outboxFile();
    if (!fs.existsSync(filePath)) return [];
    const t0 = OUTBOX_PARSE_WARN_MS > 0 ? Date.now() : 0;
    const raw = fs.readFileSync(filePath, "utf8");
    const out: OutboxRecord[] = [];
    for (const line of raw.split("\n")) {
      const t = line.trim();
      if (!t) continue;
      const rec = parseOutboxLine(t);
      if (rec) out.push(rec);
    }
    if (OUTBOX_PARSE_WARN_MS > 0) {
      const ms = Date.now() - t0;
      if (ms >= OUTBOX_PARSE_WARN_MS) {
        const msg = `[payout-outbox] Slow outbox parse ${ms} ms (${out.length} lines, ${raw.length} bytes)`;
        console.warn(msg);
        appendAdminSystemLog("warn", msg);
      }
    }
    return out;
  } catch {
    return [];
  }
}

/** Rewrite JSONL to only undelivered records (drops delivered history that blocked the event loop). */
function writePendingOutboxFile(records: OutboxRecord[]): void {
  ensureOutboxDir();
  const dest = outboxFile();
  const tmp = `${dest}.${process.pid}.tmp`;
  const body =
    records.length === 0
      ? ""
      : `${records.map((r) => recordToLine(r)).join("\n")}\n`;
  fs.writeFileSync(tmp, body, "utf8");
  fs.renameSync(tmp, dest);
}

/**
 * Load JSONL into {@link pendingRecords}, compacting delivered lines off disk.
 * Safe to call on startup and after test reloads.
 */
function reloadPendingFromDisk(): void {
  const all = readOutboxRecords();
  const pending = all.filter((r) => !deliveredClaimIds.has(r.claimId));
  pendingRecords = pending;
  if (pending.length !== all.length) {
    writePendingOutboxFile(pending);
    console.log(
      `[payout-outbox] Compacted outbox.jsonl: ${all.length} → ${pending.length} undelivered`
    );
  }
}

function outboxHasClaimId(claimId: string): boolean {
  if (deliveredClaimIds.has(claimId)) return true;
  if (pendingRecords.some((r) => r.claimId === claimId)) return true;
  return readOutboxRecords().some((r) => r.claimId === claimId);
}

/** Append a Pay-Intent to the durable outbox (idempotent by `claimId`). */
export function appendPayIntentToOutbox(intent: PayIntent): void {
  if (outboxHasClaimId(intent.claimId)) {
    console.warn(
      `[payout-outbox] Duplicate outbox append skipped claimId=${intent.claimId.slice(0, 12)}…`
    );
    return;
  }

  ensureOutboxDir();
  const record: OutboxRecord = {
    ...intent,
    enqueuedAt: Date.now(),
  };
  pendingRecords.push(record);
  fs.appendFileSync(outboxFile(), `${recordToLine(record)}\n`, "utf8");
  console.log(
    `[payout-outbox] Appended claim=${intent.claimId.slice(0, 10)}…`
  );
  if (deliveryLoopActive) {
    void drainOutboxOnce();
  }
}

export async function drainOutboxOnce(
  customDeliverer?: PayIntentDeliverer
): Promise<void> {
  if (delivering) return;
  delivering = true;
  const send = customDeliverer ?? deliverer;
  try {
    // Work from the in-memory pending list (startup / append keep it in sync).
    const snapshot = pendingRecords.slice();
    let deliveredAny = false;
    for (const record of snapshot) {
      if (deliveredClaimIds.has(record.claimId)) {
        pendingRecords = pendingRecords.filter((r) => r.claimId !== record.claimId);
        deliveredAny = true;
        continue;
      }
      if (
        shouldHoldMiningPayoutForBannedWallet(
          record.recipientAddress,
          record.tileKey
        )
      ) {
        continue;
      }
      const payload: PayIntentPayload = {
        claimId: record.claimId,
        recipientAddress: record.recipientAddress,
        amountLuna: record.amountLuna,
        roomId: record.roomId,
        tileKey: record.tileKey,
        txMessage: record.txMessage,
      };
      const result = await send(payload);
      if (!result.ok) {
        const msg = `[payout-outbox] Delivery failed claim=${record.claimId.slice(0, 10)}…: ${result.error}`;
        console.warn(msg);
        appendAdminSystemLog("warn", msg);
        continue;
      }
      deliveredClaimIds.add(record.claimId);
      appendDeliveredClaimId(record.claimId);
      pendingRecords = pendingRecords.filter((r) => r.claimId !== record.claimId);
      deliveredAny = true;
      console.log(
        `[payout-outbox] Delivered claim=${record.claimId.slice(0, 10)}…`
      );
    }
    if (deliveredAny) {
      writePendingOutboxFile(pendingRecords);
    }
  } finally {
    delivering = false;
  }
}

export function startPayoutOutboxDeliveryLoop(): void {
  loadDeliveredClaimIds();
  reloadPendingFromDisk();
  deliveryLoopActive = true;
  if (deliveryTimer) return;
  const run = async (): Promise<void> => {
    try {
      await drainOutboxOnce();
    } catch (e) {
      const msg =
        e instanceof Error
          ? `[payout-outbox] Delivery loop error: ${e.message}`
          : `[payout-outbox] Delivery loop error: ${String(e)}`;
      console.error(msg);
      appendAdminSystemLog("error", msg);
    }
    deliveryTimer = setTimeout(run, DELIVERY_INTERVAL_MS);
  };
  deliveryTimer = setTimeout(run, DELIVERY_INTERVAL_MS);
}

export function stopPayoutOutboxDeliveryLoopForTests(): void {
  deliveryLoopActive = false;
  if (deliveryTimer) {
    clearTimeout(deliveryTimer);
    deliveryTimer = null;
  }
}

/** Test helpers */
export function resetOutboxForTests(opts?: {
  deliverer?: PayIntentDeliverer;
}): void {
  stopPayoutOutboxDeliveryLoopForTests();
  deliveredClaimIds.clear();
  pendingRecords = [];
  delivering = false;
  deliverer = opts?.deliverer ?? deliverPayIntentToService;
  try {
    const ob = outboxFile();
    const jsonl = deliveredJsonlFile();
    const legacy = deliveredLegacyFile();
    const bak = `${legacy}.pre-jsonl.bak`;
    for (const f of [ob, jsonl, legacy, bak]) {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    }
  } catch {
    /* ignore */
  }
}

export function initOutboxForTests(opts?: {
  deliverer?: PayIntentDeliverer;
}): void {
  resetOutboxForTests(opts);
  loadDeliveredClaimIds();
  reloadPendingFromDisk();
}

export function listUndeliveredOutboxForTests(): OutboxRecord[] {
  return pendingRecords.slice();
}

export function isClaimDeliveredForTests(claimId: string): boolean {
  return deliveredClaimIds.has(claimId);
}

export function reloadOutboxFromDiskForTests(): void {
  loadDeliveredClaimIds();
  reloadPendingFromDisk();
}

/** Simulates a crash after service accepted but before delivered-ids were persisted. */
export function clearDeliveredClaimIdsForTests(): void {
  deliveredClaimIds.clear();
  try {
    for (const f of [
      deliveredJsonlFile(),
      deliveredLegacyFile(),
      `${deliveredLegacyFile()}.pre-jsonl.bak`,
    ]) {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    }
  } catch {
    /* ignore */
  }
}

/** Bytes on disk for `outbox.jsonl` (0 if missing). */
export function outboxFileSizeForTests(): number {
  try {
    const ob = outboxFile();
    if (!fs.existsSync(ob)) return 0;
    return fs.statSync(ob).size;
  } catch {
    return 0;
  }
}
