import type { ChainClient, PayoutSendResult } from "./types.js";

export type FakeChainSend = {
  recipientAddress: string;
  amountLuna: bigint;
  txMessage?: string;
  claimId: string;
  jobId: string;
};

export function createFakeChainClient(opts?: {
  signerConfigured?: boolean;
  initialBalanceLuna?: bigint;
  onSend?: (send: FakeChainSend) => PayoutSendResult | Promise<PayoutSendResult>;
}): ChainClient & { sends: FakeChainSend[]; balanceLuna: bigint } {
  const sends: FakeChainSend[] = [];
  let seq = 0;
  let balanceLuna = opts?.initialBalanceLuna ?? 10_000_000n;

  return {
    sends,
    balanceLuna,
    isSignerConfigured() {
      return opts?.signerConfigured ?? true;
    },
    async getWalletBalanceLuna() {
      return balanceLuna;
    },
    async sendPayout(send) {
      sends.push(send);
      if (opts?.onSend) {
        return opts.onSend(send);
      }
      seq += 1;
      return {
        txHash: `fake-tx-${seq.toString(16).padStart(8, "0")}`,
        state: "included",
      };
    },
  };
}
