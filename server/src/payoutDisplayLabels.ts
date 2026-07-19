import { playerWalletLabel } from "./playerWalletLabel.js";
import type {
  ManualBulkPayoutHistoryRow,
  PendingByRecipientSummaryRow,
  PublicPendingPayoutRow,
  PublicPendingPayoutSnapshot,
  PublicPayoutHistoryRow,
  WalletPendingPayoutDetail,
} from "./payoutServiceClient.js";

function labelWallet(walletId: string): string {
  return playerWalletLabel(walletId) || walletId;
}

export function enrichPendingPayoutSnapshotWithLabels<
  T extends PublicPendingPayoutSnapshot,
>(snap: T): T {
  return {
    ...snap,
    rows: snap.rows.map((r) => ({
      ...r,
      displayName: labelWallet(r.walletId),
    })),
    historyRows: snap.historyRows.map((r) => ({
      ...r,
      displayName: labelWallet(r.walletId),
    })),
    pendingByRecipient: snap.pendingByRecipient?.map((r) => ({
      ...r,
      displayName: labelWallet(r.walletId),
    })),
    manualBulkHistory: snap.manualBulkHistory?.map((r) => ({
      ...r,
      displayName: labelWallet(r.walletId),
    })),
  };
}

export function enrichWalletPendingDetailWithLabels(
  snap: WalletPendingPayoutDetail
): WalletPendingPayoutDetail {
  return enrichPendingPayoutSnapshotWithLabels(snap);
}

export type {
  PublicPendingPayoutRow,
  PublicPayoutHistoryRow,
  PendingByRecipientSummaryRow,
  ManualBulkPayoutHistoryRow,
};
