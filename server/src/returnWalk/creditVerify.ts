/**
 * Verify a Deposit tx: 1000 NIM to the Invoice `to` address from Resident.
 */

import { compactWalletKey } from "../walletAddresses.js";
import { RETURN_WALK_DEPOSIT_LUNA } from "./constants.js";
import { getNimRpcUrl } from "./config.js";
import { fetchTransactionDetailsViaRpc } from "./nimRpc.js";

export type DepositTxDetails = {
  hash: string;
  sender: string;
  recipient: string;
  valueLuna: bigint;
};

export type DepositTxVerifier = (
  txHash: string
) => Promise<DepositTxDetails | null>;

let injectedVerifier: DepositTxVerifier | null = null;

export function setDepositTxVerifierForTests(
  verifier: DepositTxVerifier | null
): void {
  injectedVerifier = verifier;
}

export function depositMatchesInvoice(opts: {
  tx: DepositTxDetails;
  toAddress: string;
  residentWallet: string;
}): boolean {
  if (compactWalletKey(opts.tx.sender) !== compactWalletKey(opts.residentWallet)) {
    return false;
  }
  if (compactWalletKey(opts.tx.recipient) !== compactWalletKey(opts.toAddress)) {
    return false;
  }
  return opts.tx.valueLuna === RETURN_WALK_DEPOSIT_LUNA;
}

export async function fetchDepositTx(txHash: string): Promise<DepositTxDetails | null> {
  if (injectedVerifier) return injectedVerifier(txHash);
  const rpc = getNimRpcUrl();
  if (!rpc) return null;
  try {
    return await fetchTransactionDetailsViaRpc(rpc, txHash);
  } catch (err) {
    console.warn("[return-walk] tx lookup failed:", err);
    return null;
  }
}
