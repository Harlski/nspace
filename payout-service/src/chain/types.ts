/** Lifecycle state of a transaction as reported by the Nimiq client.
 *  Mirrors `@nimiq/core` `TransactionState`, plus `"unknown"` for the case where
 *  the node cannot (yet) find a transaction we know we broadcast. */
export type TxLifecycleState =
  | "new"
  | "pending"
  | "included"
  | "confirmed"
  | "invalidated"
  | "expired"
  | "unknown";

/** States in which the transaction has provably moved funds (or will, once mined
 *  from the mempool). Once a payout reaches one of these, its jobs must never be
 *  re-sent. */
export function isValueMovingState(state: TxLifecycleState): boolean {
  return state === "confirmed" || state === "included" || state === "pending";
}

/** States in which the transaction is provably dead and moved no funds, so the
 *  underlying jobs are safe to re-send. */
export function isDeadState(state: TxLifecycleState): boolean {
  return state === "expired" || state === "invalidated";
}

export type PayoutSendResult = {
  txHash: string;
  /** Confirmation state at the moment {@link ChainClient.sendPayout} returned.
   *  A returned result ALWAYS means the transaction was broadcast to the network. */
  state: TxLifecycleState;
};

/** A single outgoing transaction observed on-chain, used by the offline
 *  reconciliation tool to detect payouts that were broadcast but never recorded. */
export type OnChainOutgoingTx = {
  txHash: string;
  recipient: string;
  valueLuna: bigint;
  blockHeight: number | null;
  timestamp: number | null;
  state: TxLifecycleState;
};

/** Single chokepoint for all on-chain payout work inside the Payout Service. */
export type ChainClient = {
  isSignerConfigured(): boolean;
  getWalletBalanceLuna(): Promise<bigint>;
  /**
   * Broadcasts a payout and waits (up to `NIM_TX_CONFIRM_TIMEOUT_MS`) for confirmation.
   *
   * INVARIANT: this rejects ONLY when the transaction was never broadcast (e.g. no
   * consensus, build/sign error, or the network rejected the submission). A rejection
   * therefore means it is safe to retry.
   *
   * If it resolves, the transaction WAS broadcast and its jobs must never be re-sent.
   * `state` reflects confirmation progress: `"confirmed"`/`"included"` = settled,
   * `"pending"` = broadcast but not yet confirmed within the timeout, and
   * `"expired"`/`"invalidated"` = the broadcast transaction is dead (no funds moved),
   * so callers may safely re-enqueue.
   */
  sendPayout(opts: {
    recipientAddress: string;
    amountLuna: bigint;
    txMessage?: string;
    claimId: string;
    jobId: string;
  }): Promise<PayoutSendResult>;
  /** Current lifecycle state of a previously broadcast transaction. Returns
   *  `"unknown"` (never throws) if the node cannot find it. */
  getTransactionState(txHash: string): Promise<TxLifecycleState>;
};
