/**
 * Records payout-sidecar sends into the gameplay event log for /analytics.
 * Before ADR-0002 cutover this lived in server/src/nimPayout/queue.ts.
 */
import fs from "node:fs";
import path from "node:path";
import { timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { fileURLToPath } from "node:url";
import {
  ANALYTICS_EVENT_KINDS,
  logGameplayEvent,
} from "./eventLog.js";
import {
  fetchSentHistoryFromService,
  isPayoutServiceClientConfigured,
} from "./payoutServiceClient.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SYNC_DIR = process.env.PAYOUT_ANALYTICS_SYNC_DIR
  ? path.resolve(process.env.PAYOUT_ANALYTICS_SYNC_DIR)
  : path.join(__dirname, "..", "data", "payout-analytics");

const SYNCED_CLAIM_IDS_FILE = path.join(SYNC_DIR, "synced-claim-ids.json");
const SYNCED_DEAD_LETTERS_FILE = path.join(SYNC_DIR, "synced-dead-letter-claim-ids.json");

const syncedSentClaimIds = new Set<string>();
const syncedDeadLetterClaimIds = new Set<string>();

export type PayoutSentAnalyticsPayload = {
  claimId: string;
  recipientAddress: string;
  roomId: string;
  tileKey: string;
  txHash: string;
  sentAt: number;
  enqueuedAt: number;
  amountLuna: string;
  jobId?: string;
  state?: string;
  queueToSendMs?: number;
  manualBulk?: boolean;
  bulkTotalLuna?: string;
  sessionId?: string;
};

export type PayoutDeadLetterAnalyticsPayload = {
  claimId: string;
  recipientAddress: string;
  roomId: string;
  tileKey: string;
  error: string;
  attempts: number;
  jobId?: string;
  sessionId?: string;
};

function payoutServiceApiSecret(): string | null {
  const s = process.env.PAYOUT_SERVICE_API_SECRET?.trim();
  return s || null;
}

function bearerMatchesPayoutServiceSecret(token: string | null): boolean {
  const secret = payoutServiceApiSecret();
  if (!token || !secret) return false;
  const a = Buffer.from(token, "utf8");
  const b = Buffer.from(secret, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function requirePayoutServiceBearer(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const h = req.headers.authorization;
  const token =
    typeof h === "string" && h.startsWith("Bearer ")
      ? h.slice("Bearer ".length).trim()
      : "";
  if (!bearerMatchesPayoutServiceSecret(token)) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  next();
}

function ensureSyncDir(): void {
  fs.mkdirSync(SYNC_DIR, { recursive: true });
}

function loadSyncedIds(file: string, target: Set<string>): void {
  target.clear();
  try {
    if (!fs.existsSync(file)) return;
    const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
    if (!Array.isArray(parsed)) return;
    for (const id of parsed) {
      if (typeof id === "string" && id.trim()) target.add(id.trim());
    }
  } catch (e) {
    console.error("[payout-analytics] Failed to load synced ids:", e);
  }
}

function persistSyncedIds(file: string, target: Set<string>): void {
  try {
    ensureSyncDir();
    const payload = JSON.stringify([...target]);
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, payload, "utf8");
    fs.renameSync(tmp, file);
  } catch (e) {
    console.error("[payout-analytics] Failed to persist synced ids:", e);
  }
}

export function initPayoutAnalyticsBridgeForRuntime(): void {
  loadSyncedIds(SYNCED_CLAIM_IDS_FILE, syncedSentClaimIds);
  loadSyncedIds(SYNCED_DEAD_LETTERS_FILE, syncedDeadLetterClaimIds);
}

/** Test helper */
export function resetPayoutAnalyticsBridgeForTests(): void {
  syncedSentClaimIds.clear();
  syncedDeadLetterClaimIds.clear();
  try {
    if (fs.existsSync(SYNCED_CLAIM_IDS_FILE)) fs.unlinkSync(SYNCED_CLAIM_IDS_FILE);
    if (fs.existsSync(SYNCED_DEAD_LETTERS_FILE)) {
      fs.unlinkSync(SYNCED_DEAD_LETTERS_FILE);
    }
  } catch {
    /* ignore */
  }
}

function normalizeClaimId(raw: unknown): string {
  return typeof raw === "string" ? raw.trim() : "";
}

function normalizeAmountLuna(raw: unknown): string | null {
  if (typeof raw !== "string" || !/^\d+$/.test(raw)) return null;
  return raw;
}

export function recordPayoutSentAnalyticsEvent(
  input: PayoutSentAnalyticsPayload
): { recorded: boolean; duplicate: boolean } {
  const claimId = normalizeClaimId(input.claimId);
  const txHash = typeof input.txHash === "string" ? input.txHash.trim() : "";
  const recipientAddress =
    typeof input.recipientAddress === "string" ? input.recipientAddress.trim() : "";
  const roomId = typeof input.roomId === "string" ? input.roomId.trim() : "";
  const tileKey = typeof input.tileKey === "string" ? input.tileKey.trim() : "";
  const amountLuna = normalizeAmountLuna(input.amountLuna);
  const sentAt =
    typeof input.sentAt === "number" && Number.isFinite(input.sentAt)
      ? input.sentAt
      : Date.now();
  const enqueuedAt =
    typeof input.enqueuedAt === "number" && Number.isFinite(input.enqueuedAt)
      ? input.enqueuedAt
      : sentAt;

  if (!claimId || !txHash || !recipientAddress || !roomId || !tileKey || !amountLuna) {
    return { recorded: false, duplicate: false };
  }
  if (syncedSentClaimIds.has(claimId)) {
    return { recorded: false, duplicate: true };
  }

  const queueToSendMs =
    typeof input.queueToSendMs === "number" && Number.isFinite(input.queueToSendMs)
      ? input.queueToSendMs
      : sentAt - enqueuedAt;

  const sessionId =
    typeof input.sessionId === "string" && input.sessionId.trim()
      ? input.sessionId.trim()
      : input.manualBulk
        ? "nim-payout-manual-bulk"
        : "nim-payout-worker";

  logGameplayEvent(sessionId, recipientAddress, roomId, ANALYTICS_EVENT_KINDS.nimPayoutSent, {
    claimId,
    txHash,
    state: typeof input.state === "string" ? input.state : undefined,
    tileKey,
    jobId: typeof input.jobId === "string" ? input.jobId : undefined,
    enqueuedAt,
    sentAt,
    queueToSendMs,
    amountLuna,
    ...(input.manualBulk ? { manualBulk: true } : {}),
    ...(input.bulkTotalLuna ? { bulkTotalLuna: input.bulkTotalLuna } : {}),
  });

  syncedSentClaimIds.add(claimId);
  persistSyncedIds(SYNCED_CLAIM_IDS_FILE, syncedSentClaimIds);
  return { recorded: true, duplicate: false };
}

export function recordPayoutDeadLetterAnalyticsEvent(
  input: PayoutDeadLetterAnalyticsPayload
): { recorded: boolean; duplicate: boolean } {
  const claimId = normalizeClaimId(input.claimId);
  const recipientAddress =
    typeof input.recipientAddress === "string" ? input.recipientAddress.trim() : "";
  const roomId = typeof input.roomId === "string" ? input.roomId.trim() : "";
  const tileKey = typeof input.tileKey === "string" ? input.tileKey.trim() : "";
  const error = typeof input.error === "string" ? input.error : "";
  const attempts =
    typeof input.attempts === "number" && Number.isFinite(input.attempts)
      ? input.attempts
      : 0;

  if (!claimId || !recipientAddress || !roomId || !tileKey || !error) {
    return { recorded: false, duplicate: false };
  }
  if (syncedDeadLetterClaimIds.has(claimId)) {
    return { recorded: false, duplicate: true };
  }

  const sessionId =
    typeof input.sessionId === "string" && input.sessionId.trim()
      ? input.sessionId.trim()
      : "nim-payout-worker";

  logGameplayEvent(
    sessionId,
    recipientAddress,
    roomId,
    ANALYTICS_EVENT_KINDS.nimPayoutDeadLetter,
    {
      claimId,
      error,
      attempts,
      tileKey,
      jobId: typeof input.jobId === "string" ? input.jobId : undefined,
    }
  );

  syncedDeadLetterClaimIds.add(claimId);
  persistSyncedIds(SYNCED_DEAD_LETTERS_FILE, syncedDeadLetterClaimIds);
  return { recorded: true, duplicate: false };
}

export function handlePayoutAnalyticsEventPost(req: Request, res: Response): void {
  const body = req.body as Record<string, unknown> | null;
  const kind = typeof body?.kind === "string" ? body.kind : "";
  if (kind === ANALYTICS_EVENT_KINDS.nimPayoutSent) {
    const payload = (body?.payload ?? body) as Record<string, unknown>;
    const out = recordPayoutSentAnalyticsEvent({
      claimId: String(payload.claimId ?? ""),
      recipientAddress: String(payload.recipientAddress ?? payload.recipient ?? ""),
      roomId: String(payload.roomId ?? ""),
      tileKey: String(payload.tileKey ?? ""),
      txHash: String(payload.txHash ?? ""),
      sentAt: Number(payload.sentAt),
      enqueuedAt: Number(payload.enqueuedAt),
      amountLuna: String(payload.amountLuna ?? ""),
      jobId: typeof payload.jobId === "string" ? payload.jobId : undefined,
      state: typeof payload.state === "string" ? payload.state : undefined,
      queueToSendMs:
        typeof payload.queueToSendMs === "number" ? payload.queueToSendMs : undefined,
      manualBulk: payload.manualBulk === true,
      bulkTotalLuna:
        typeof payload.bulkTotalLuna === "string" ? payload.bulkTotalLuna : undefined,
      sessionId: typeof payload.sessionId === "string" ? payload.sessionId : undefined,
    });
    if (!out.recorded && !out.duplicate) {
      res.status(400).json({ error: "invalid_payload" });
      return;
    }
    res.status(out.duplicate ? 200 : 201).json({ ok: true, duplicate: out.duplicate });
    return;
  }
  if (kind === ANALYTICS_EVENT_KINDS.nimPayoutDeadLetter) {
    const payload = (body?.payload ?? body) as Record<string, unknown>;
    const out = recordPayoutDeadLetterAnalyticsEvent({
      claimId: String(payload.claimId ?? ""),
      recipientAddress: String(payload.recipientAddress ?? payload.recipient ?? ""),
      roomId: String(payload.roomId ?? ""),
      tileKey: String(payload.tileKey ?? ""),
      error: String(payload.error ?? ""),
      attempts: Number(payload.attempts),
      jobId: typeof payload.jobId === "string" ? payload.jobId : undefined,
      sessionId: typeof payload.sessionId === "string" ? payload.sessionId : undefined,
    });
    if (!out.recorded && !out.duplicate) {
      res.status(400).json({ error: "invalid_payload" });
      return;
    }
    res.status(out.duplicate ? 200 : 201).json({ ok: true, duplicate: out.duplicate });
    return;
  }
  res.status(400).json({ error: "unknown_kind" });
}

const BACKFILL_SINCE_MS = Math.max(
  0,
  Number(process.env.PAYOUT_ANALYTICS_BACKFILL_SINCE_MS ?? Date.parse("2026-06-21T00:00:00.000Z"))
);

export async function backfillPayoutAnalyticsFromServiceOnce(): Promise<{
  sentRecorded: number;
  sentSkipped: number;
}> {
  if (!isPayoutServiceClientConfigured()) {
    return { sentRecorded: 0, sentSkipped: 0 };
  }
  initPayoutAnalyticsBridgeForRuntime();
  const sinceMs = BACKFILL_SINCE_MS;
  let sentRecorded = 0;
  let sentSkipped = 0;
  let cursor = sinceMs;
  for (;;) {
    const batch = await fetchSentHistoryFromService({ sinceMs: cursor, limit: 500 });
    if (!batch.ok) {
      console.warn(
        `[payout-analytics] Backfill skipped: ${batch.error}`
      );
      break;
    }
    if (batch.data.length === 0) break;
    let maxSentAt = cursor;
    for (const row of batch.data) {
      maxSentAt = Math.max(maxSentAt, row.sentAt);
      const out = recordPayoutSentAnalyticsEvent({
        claimId: row.claimId,
        recipientAddress: row.recipient,
        roomId: row.roomId,
        tileKey: row.tileKey,
        txHash: row.txHash,
        sentAt: row.sentAt,
        enqueuedAt: row.enqueuedAt,
        amountLuna: row.amountLuna,
        jobId: row.jobId,
        state: row.state,
        queueToSendMs: row.sentAt - row.enqueuedAt,
        manualBulk: row.manualBulk,
        bulkTotalLuna: row.bulkTotalLuna,
      });
      if (out.recorded) sentRecorded += 1;
      else sentSkipped += 1;
    }
    if (batch.data.length < 500) break;
    cursor = maxSentAt + 1;
  }
  if (sentRecorded > 0) {
    console.log(
      `[payout-analytics] Backfilled ${sentRecorded} nim_payout_sent event(s) from payout service`
    );
  }
  return { sentRecorded, sentSkipped };
}

export function startPayoutAnalyticsBackfillSync(): void {
  void backfillPayoutAnalyticsFromServiceOnce().catch((e) => {
    console.error("[payout-analytics] Backfill error:", e);
  });
}
