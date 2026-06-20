export type PayoutSendResult = {
  txHash: string;
  state: string;
};

/** Single chokepoint for all on-chain payout work inside the Payout Service. */
export type ChainClient = {
  isSignerConfigured(): boolean;
  getWalletBalanceLuna(): Promise<bigint>;
  sendPayout(opts: {
    recipientAddress: string;
    amountLuna: bigint;
    txMessage?: string;
    claimId: string;
    jobId: string;
  }): Promise<PayoutSendResult>;
};
