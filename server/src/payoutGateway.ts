/**
 * Single chokepoint for all outgoing-NIM interactions in the game server.
 * Pay-Intents route through the durable Outbox to the Payout Service sidecar.
 */
import { nimiqIdenticonDataUrl } from "./nimiqIdenticonServer.js";
import { appendPayIntentToOutbox } from "./payoutOutbox.js";
import {
  getPulledBalanceLuna,
  peekPulledBalanceCacheLuna,
} from "./payoutBalancePull.js";
import {
  enrichPendingPayoutSnapshotWithLabels,
  enrichWalletPendingDetailWithLabels,
} from "./payoutDisplayLabels.js";
import {
  fetchPendingQueueTotalsFromService,
  fetchPendingSnapshotFromService,
  fetchPublicPendingSummaryFromService,
  isPayoutServiceClientConfigured,
  triggerEndOfDayFlushViaService,
  triggerManualBulkPayoutViaService,
  type FlushAllPendingPayoutsResult,
  type ManualBulkPayoutHistoryRow,
  type PayIntent,
  type PendingByRecipientSummaryRow,
  type PendingPayoutQueueTotals,
  type PublicPendingPayoutRow,
  type PublicPayoutHistoryRow,
  type PublicPendingPayoutSnapshot,
  type PublicPendingPayoutSummary,
  type WalletPendingPayoutDetail,
} from "./payoutServiceClient.js";

export const LUNA_PER_NIM = 100_000n;

export type { PayIntent };

export {
  type FlushAllPendingPayoutsResult,
  type ManualBulkPayoutHistoryRow,
  type PendingByRecipientSummaryRow,
  type PendingPayoutQueueTotals,
  type PublicPendingPayoutRow,
  type PublicPayoutHistoryRow,
  type PublicPendingPayoutSnapshot,
  type PublicPendingPayoutSummary,
  type WalletPendingPayoutDetail,
};

/** Whether Pay-Intents ship via Outbox → Payout Service. */
export function isPayoutServiceMode(): boolean {
  return isPayoutServiceClientConfigured();
}

/** Whether outgoing NIM rewards are enabled (Payout Service client configured). */
export function isPayoutSenderConfigured(): boolean {
  return isPayoutServiceClientConfigured();
}

/**
 * Enqueue a Pay-Intent (idempotent by `claimId`) to the durable Outbox for
 * at-least-once delivery to the Payout Service.
 */
export function enqueuePayIntent(opts: PayIntent): void {
  appendPayIntentToOutbox(opts);
}

/** Alias for {@link enqueuePayIntent} (block claims use the same path). */
export function enqueueBlockClaimPayIntent(opts: PayIntent): void {
  enqueuePayIntent(opts);
}

export function peekPayoutBalanceCacheLuna(): {
  luna: bigint;
  cachedAtMs: number;
} | null {
  return peekPulledBalanceCacheLuna();
}

export async function getPayoutWalletBalanceLuna(): Promise<bigint> {
  return getPulledBalanceLuna();
}

async function enrichSnapshotWithIdenticons(
  snap: PublicPendingPayoutSnapshot
): Promise<PublicPendingPayoutSnapshot> {
  const rows = await Promise.all(
    snap.rows.map(async (r) => ({
      ...r,
      identicon: r.identicon || (await nimiqIdenticonDataUrl(r.walletId)),
    }))
  );
  const historyRows = await Promise.all(
    snap.historyRows.map(async (r) => ({
      ...r,
      identicon: r.identicon || (await nimiqIdenticonDataUrl(r.walletId)),
    }))
  );
  return { ...snap, rows, historyRows };
}

async function serviceOrThrow<T>(
  result: { ok: true; data: T } | { ok: false; error: string }
): Promise<T> {
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.data;
}

const PAYOUT_SERVICE_OFF_MESSAGE = "Payout service not configured on this server.";

const EMPTY_PUBLIC_PENDING_SUMMARY: PublicPendingPayoutSummary = {
  mode: "summary",
  pendingTotal: 0,
  processedToday: 0,
  allSent: true,
  message: PAYOUT_SERVICE_OFF_MESSAGE,
};

const EMPTY_PUBLIC_PENDING_SNAPSHOT: PublicPendingPayoutSnapshot = {
  allSent: true,
  pendingTotal: 0,
  message: PAYOUT_SERVICE_OFF_MESSAGE,
  rows: [],
  historyRows: [],
};

function emptyWalletPendingDetail(): WalletPendingPayoutDetail {
  return {
    ...EMPTY_PUBLIC_PENDING_SNAPSHOT,
    mode: "wallet",
    processedToday: 0,
  };
}

export async function getPendingQueueTotals(): Promise<PendingPayoutQueueTotals> {
  if (!isPayoutServiceClientConfigured()) {
    return {
      jobCount: 0,
      recipientCount: 0,
      totalLuna: "0",
      totalNim: "0.0000",
    };
  }
  return serviceOrThrow(await fetchPendingQueueTotalsFromService());
}

export async function getPublicPendingSummary(): Promise<PublicPendingPayoutSummary> {
  if (!isPayoutServiceClientConfigured()) {
    return EMPTY_PUBLIC_PENDING_SUMMARY;
  }
  return serviceOrThrow(await fetchPublicPendingSummaryFromService());
}

export async function getPublicPendingAdminPanelSnapshot(): Promise<PublicPendingPayoutSnapshot> {
  if (!isPayoutServiceClientConfigured()) {
    return EMPTY_PUBLIC_PENDING_SNAPSHOT;
  }
  const snap = await serviceOrThrow(
    await fetchPendingSnapshotFromService({ adminPanel: true })
  );
  return enrichPendingPayoutSnapshotWithLabels(snap);
}

export async function getPublicPendingSnapshot(): Promise<PublicPendingPayoutSnapshot> {
  if (!isPayoutServiceClientConfigured()) {
    return EMPTY_PUBLIC_PENDING_SNAPSHOT;
  }
  const snap = await serviceOrThrow(await fetchPendingSnapshotFromService());
  const withIcons = await enrichSnapshotWithIdenticons(snap);
  return enrichPendingPayoutSnapshotWithLabels(withIcons);
}

export async function getPendingSnapshotForWallet(
  walletId: string
): Promise<WalletPendingPayoutDetail> {
  if (!isPayoutServiceClientConfigured()) {
    return emptyWalletPendingDetail();
  }
  const result = await fetchPendingSnapshotFromService({ wallet: walletId });
  if (!result.ok) throw new Error(result.error);
  const snap = result.data;
  if (!("mode" in snap) || snap.mode !== "wallet") {
    throw new Error("invalid_response");
  }
  const enriched = await enrichSnapshotWithIdenticons(snap);
  return enrichWalletPendingDetailWithLabels({
    ...enriched,
    mode: "wallet",
    processedToday: snap.processedToday,
  });
}

/** Admin "Payout in full" for one recipient. */
export async function triggerManualBulkPayout(recipient: string) {
  return serviceOrThrow(await triggerManualBulkPayoutViaService(recipient));
}

/** End-of-day flush: bulk-settle every recipient with pending jobs. */
export async function triggerEndOfDayFlush(): Promise<FlushAllPendingPayoutsResult> {
  return serviceOrThrow(await triggerEndOfDayFlushViaService());
}
