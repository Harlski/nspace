/**
 * Single chokepoint for all outgoing-NIM interactions in the game server.
 * Slice 0 delegates in-process to `nimPayout/*`; slice 1 routes block-claim
 * Pay-Intents through the durable Outbox when the Payout Service is configured.
 */
import {
  enqueueNimPayout,
  flushAllPendingPayoutsNow,
  flushNimPayoutQueueSync,
  getPendingPayoutQueueTotals,
  getPendingPayoutSnapshotForWallet,
  getPublicPendingPayoutAdminPanelSnapshot,
  getPublicPendingPayoutSnapshot,
  getPublicPendingPayoutSummary,
  manualBulkPayoutPendingForRecipient,
  startNimPayoutProcessor,
  type FlushAllPendingPayoutsResult,
  type ManualBulkPayoutHistoryRow,
  type PendingByRecipientSummaryRow,
  type PendingPayoutQueueTotals,
  type PublicPendingPayoutRow,
  type PublicPayoutHistoryRow,
  type PublicPendingPayoutSnapshot,
  type PublicPendingPayoutSummary,
  type WalletPendingPayoutDetail,
} from "./nimPayout/queue.js";
import {
  getNimPayoutWalletBalanceLuna,
  isNimPayoutSenderConfigured,
  LUNA_PER_NIM,
  peekNimPayoutBalanceCacheLuna,
} from "./nimPayout/sender.js";
import { appendPayIntentToOutbox } from "./payoutOutbox.js";
import {
  getPulledBalanceLuna,
  peekPulledBalanceCacheLuna,
} from "./payoutBalancePull.js";
import {
  isPayoutServiceClientConfigured,
  type PayIntent,
} from "./payoutServiceClient.js";

export type { PayIntent };

export {
  LUNA_PER_NIM,
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

/** Whether block-claim rewards should ship via Outbox → Payout Service. */
export function isPayoutServiceMode(): boolean {
  return isPayoutServiceClientConfigured();
}

/** Enqueue a Pay-Intent for the in-process payout processor (idempotent by `claimId`). */
export function enqueuePayIntent(opts: PayIntent): void {
  enqueueNimPayout(opts);
}

/**
 * Enqueue a block-claim Pay-Intent: Outbox → Payout Service when configured,
 * otherwise the in-process processor (same as {@link enqueuePayIntent}).
 */
export function enqueueBlockClaimPayIntent(opts: PayIntent): void {
  if (isPayoutServiceMode()) {
    appendPayIntentToOutbox(opts);
    return;
  }
  enqueueNimPayout(opts);
}

export function isPayoutSenderConfigured(): boolean {
  if (isPayoutServiceMode()) return true;
  return isNimPayoutSenderConfigured();
}

export function peekPayoutBalanceCacheLuna(): {
  luna: bigint;
  cachedAtMs: number;
} | null {
  if (isPayoutServiceMode()) return peekPulledBalanceCacheLuna();
  return peekNimPayoutBalanceCacheLuna();
}

export async function getPayoutWalletBalanceLuna(): Promise<bigint> {
  if (isPayoutServiceMode()) return getPulledBalanceLuna();
  return getNimPayoutWalletBalanceLuna();
}

export function startPayoutProcessor(): void {
  startNimPayoutProcessor();
}

/** Persist the in-memory payout queue before process exit. */
export function flushPayoutQueueOnShutdown(): void {
  flushNimPayoutQueueSync();
}

export function getPendingQueueTotals(): PendingPayoutQueueTotals {
  return getPendingPayoutQueueTotals();
}

export async function getPublicPendingSummary(): Promise<PublicPendingPayoutSummary> {
  return getPublicPendingPayoutSummary();
}

export function getPublicPendingAdminPanelSnapshot(): PublicPendingPayoutSnapshot {
  return getPublicPendingPayoutAdminPanelSnapshot();
}

export async function getPublicPendingSnapshot(): Promise<PublicPendingPayoutSnapshot> {
  return getPublicPendingPayoutSnapshot();
}

export async function getPendingSnapshotForWallet(
  walletId: string
): Promise<WalletPendingPayoutDetail> {
  return getPendingPayoutSnapshotForWallet(walletId);
}

/** Admin "Payout in full" for one recipient. */
export async function triggerManualBulkPayout(recipient: string) {
  return manualBulkPayoutPendingForRecipient(recipient);
}

/** End-of-day flush: bulk-settle every recipient with pending jobs. */
export async function triggerEndOfDayFlush(): Promise<FlushAllPendingPayoutsResult> {
  return flushAllPendingPayoutsNow();
}
