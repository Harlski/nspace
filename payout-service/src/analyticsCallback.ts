/**
 * Notify the game server when payouts complete so /analytics event logs stay populated.
 */
import type { AppConfig } from "./config.js";
import type { PayoutJob } from "./queue.js";

const ANALYTICS_PATH = "/internal/v1/payout-analytics-events";

let callbackBaseUrl: string | null = null;
let callbackSecret: string | null = null;
let warnedMissingUrl = false;

export function initAnalyticsCallback(cfg: AppConfig): void {
  callbackBaseUrl = cfg.gameServerInternalUrl;
  callbackSecret = cfg.apiSecret;
  if (!callbackBaseUrl && !warnedMissingUrl) {
    warnedMissingUrl = true;
    console.warn(
      "[payout-service] GAME_SERVER_INTERNAL_URL unset — nim_payout_sent analytics callbacks disabled (game server backfill sync may still apply)"
    );
  }
}

async function postAnalyticsEvent(body: Record<string, unknown>): Promise<void> {
  const base = callbackBaseUrl?.replace(/\/+$/, "");
  const secret = callbackSecret;
  if (!base || !secret) return;
  try {
    const res = await fetch(`${base}${ANALYTICS_PATH}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${secret}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn(
        `[payout-service] Analytics callback HTTP ${res.status}: ${text.slice(0, 200)}`
      );
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`[payout-service] Analytics callback failed: ${msg}`);
  }
}

export function notifyPayoutSentAnalytics(opts: {
  job: Pick<
    PayoutJob,
    | "claimId"
    | "recipientAddress"
    | "roomId"
    | "tileKey"
    | "createdAt"
    | "amountLuna"
    | "id"
  >;
  txHash: string;
  sentAt: number;
  state?: string;
  manualBulk?: boolean;
  bulkTotalLuna?: string;
}): void {
  const { job, txHash, sentAt, state, manualBulk, bulkTotalLuna } = opts;
  void postAnalyticsEvent({
    kind: "nim_payout_sent",
    payload: {
      claimId: job.claimId,
      recipientAddress: job.recipientAddress,
      roomId: job.roomId,
      tileKey: job.tileKey,
      txHash,
      sentAt,
      enqueuedAt: job.createdAt,
      amountLuna: job.amountLuna.toString(),
      jobId: job.id,
      state,
      queueToSendMs: sentAt - job.createdAt,
      ...(manualBulk ? { manualBulk: true } : {}),
      ...(bulkTotalLuna ? { bulkTotalLuna } : {}),
    },
  });
}

export function notifyPayoutDeadLetterAnalytics(opts: {
  job: Pick<
    PayoutJob,
    "claimId" | "recipientAddress" | "roomId" | "tileKey" | "id" | "attempts"
  >;
  error: string;
}): void {
  const { job, error } = opts;
  void postAnalyticsEvent({
    kind: "nim_payout_dead_letter",
    payload: {
      claimId: job.claimId,
      recipientAddress: job.recipientAddress,
      roomId: job.roomId,
      tileKey: job.tileKey,
      error,
      attempts: job.attempts,
      jobId: job.id,
    },
  });
}

/** Test helper: point callbacks at a mock server. */
export function setAnalyticsCallbackForTests(baseUrl: string | null, secret: string): void {
  callbackBaseUrl = baseUrl;
  callbackSecret = secret;
}
