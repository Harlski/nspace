import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { appendAdminSystemLog } from "./adminSystemMonitor.js";
import type { PayIntent } from "./payoutServiceClient.js";
import {
  deliverPayIntentToService,
  type PayIntentDeliverer,
  type PayIntentPayload,
} from "./payoutServiceClient.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const OUTBOX_DIR = process.env.PAYOUT_OUTBOX_DIR
  ? path.resolve(process.env.PAYOUT_OUTBOX_DIR)
  : path.join(__dirname, "..", "data", "payout-outbox");

const OUTBOX_FILE = path.join(OUTBOX_DIR, "outbox.jsonl");
const DELIVERED_FILE = path.join(OUTBOX_DIR, "delivered-claim-ids.json");

type OutboxRecord = PayIntent & { enqueuedAt: number };

const deliveredClaimIds = new Set<string>();
let deliveryTimer: ReturnType<typeof setTimeout> | null = null;
let deliveryLoopActive = false;
let delivering = false;
let deliverer: PayIntentDeliverer = deliverPayIntentToService;

const DELIVERY_INTERVAL_MS = Math.max(
  500,
  Number(process.env.PAYOUT_OUTBOX_DELIVERY_INTERVAL_MS ?? 2000)
);

function ensureOutboxDir(): void {
  fs.mkdirSync(OUTBOX_DIR, { recursive: true });
}

function loadDeliveredClaimIds(): void {
  deliveredClaimIds.clear();
  try {
    if (!fs.existsSync(DELIVERED_FILE)) return;
    const raw = fs.readFileSync(DELIVERED_FILE, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return;
    for (const id of parsed) {
      if (typeof id === "string" && id.trim()) {
        deliveredClaimIds.add(id.trim());
      }
    }
  } catch (e) {
    console.error("[payout-outbox] Failed to load delivered claim ids:", e);
  }
}

function persistDeliveredClaimIds(): void {
  try {
    ensureOutboxDir();
    const payload = JSON.stringify([...deliveredClaimIds]);
    const tmp = `${DELIVERED_FILE}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, payload, "utf8");
    fs.renameSync(tmp, DELIVERED_FILE);
  } catch (e) {
    console.error("[payout-outbox] Failed to persist delivered claim ids:", e);
  }
}

function readOutboxRecords(): OutboxRecord[] {
  try {
    if (!fs.existsSync(OUTBOX_FILE)) return [];
    const raw = fs.readFileSync(OUTBOX_FILE, "utf8");
    const lines = raw.split("\n").filter((l) => l.trim());
    const out: OutboxRecord[] = [];
    for (const line of lines) {
      try {
        const o = JSON.parse(line) as OutboxRecord & { amountLuna?: string };
        if (typeof o.claimId !== "string" || !o.claimId.trim()) continue;
        if (typeof o.recipientAddress !== "string") continue;
        if (typeof o.roomId !== "string") continue;
        if (typeof o.tileKey !== "string") continue;
        out.push({
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
        });
      } catch {
        /* skip bad line */
      }
    }
    return out;
  } catch {
    return [];
  }
}

function outboxHasClaimId(claimId: string): boolean {
  if (deliveredClaimIds.has(claimId)) return true;
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
  const line = JSON.stringify({
    ...record,
    amountLuna: record.amountLuna?.toString(),
  });
  fs.appendFileSync(OUTBOX_FILE, `${line}\n`, "utf8");
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
    const pending = readOutboxRecords().filter(
      (r) => !deliveredClaimIds.has(r.claimId)
    );
    for (const record of pending) {
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
      persistDeliveredClaimIds();
      console.log(
        `[payout-outbox] Delivered claim=${record.claimId.slice(0, 10)}…`
      );
    }
  } finally {
    delivering = false;
  }
}

export function startPayoutOutboxDeliveryLoop(): void {
  loadDeliveredClaimIds();
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
  delivering = false;
  deliverer = opts?.deliverer ?? deliverPayIntentToService;
  try {
    if (fs.existsSync(OUTBOX_FILE)) fs.unlinkSync(OUTBOX_FILE);
    if (fs.existsSync(DELIVERED_FILE)) fs.unlinkSync(DELIVERED_FILE);
  } catch {
    /* ignore */
  }
}

export function initOutboxForTests(opts?: {
  deliverer?: PayIntentDeliverer;
}): void {
  resetOutboxForTests(opts);
  loadDeliveredClaimIds();
}

export function listUndeliveredOutboxForTests(): OutboxRecord[] {
  return readOutboxRecords().filter((r) => !deliveredClaimIds.has(r.claimId));
}

export function isClaimDeliveredForTests(claimId: string): boolean {
  return deliveredClaimIds.has(claimId);
}

export function reloadOutboxFromDiskForTests(): void {
  loadDeliveredClaimIds();
}

/** Simulates a crash after service accepted but before delivered-ids were persisted. */
export function clearDeliveredClaimIdsForTests(): void {
  deliveredClaimIds.clear();
  try {
    if (fs.existsSync(DELIVERED_FILE)) fs.unlinkSync(DELIVERED_FILE);
  } catch {
    /* ignore */
  }
}
