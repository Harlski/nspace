/**
 * Watch the Server Wallet for credited Deposits (tx POST is a hint, not the only path).
 */

import { compactWalletKey, formatWalletAddressGrouped } from "../walletAddresses.js";
import { RETURN_WALK_DEPOSIT_LUNA } from "./constants.js";
import { getNimRpcUrl, getServerWalletAddress } from "./config.js";
import {
  creditInvoice,
  findInvoiceByTxHash,
  listUnpaidInvoices,
} from "./store.js";
import { fetchRecentTransactionsForAddress } from "./nimRpc.js";
import {
  depositMatchesInvoice,
  type DepositTxDetails,
} from "./creditVerify.js";

const WATCH_INTERVAL_MS = 15_000;

let watchTimer: ReturnType<typeof setInterval> | null = null;

function txFromRpc(raw: {
  hash?: string;
  from?: string;
  fromAddress?: string;
  to?: string;
  toAddress?: string;
  value?: number | string;
}): DepositTxDetails | null {
  const hash = String(raw.hash ?? "").trim();
  if (!hash) return null;
  const sender = String(raw.fromAddress ?? raw.from ?? "").trim();
  const recipient = String(raw.toAddress ?? raw.to ?? "").trim();
  const valueRaw = raw.value;
  const valueLuna =
    typeof valueRaw === "string" && /^\d+$/.test(valueRaw)
      ? BigInt(valueRaw)
      : BigInt(Math.trunc(Number(valueRaw ?? 0)));
  if (!sender || !recipient) return null;
  return {
    hash,
    sender: formatWalletAddressGrouped(compactWalletKey(sender)),
    recipient: formatWalletAddressGrouped(compactWalletKey(recipient)),
    valueLuna,
  };
}

export async function scanServerWalletForDeposits(): Promise<number> {
  const rpc = getNimRpcUrl();
  const to = getServerWalletAddress();
  if (!rpc || !to) return 0;
  const unpaid = listUnpaidInvoices();
  if (unpaid.length === 0) return 0;
  let credited = 0;
  try {
    const txs = await fetchRecentTransactionsForAddress(rpc, to);
    for (const raw of txs) {
      const tx = txFromRpc(raw);
      if (!tx) continue;
      if (findInvoiceByTxHash(tx.hash)) continue;
      if (tx.valueLuna !== RETURN_WALK_DEPOSIT_LUNA) continue;
      for (const inv of unpaid) {
        if (
          depositMatchesInvoice({
            tx,
            toAddress: inv.toAddress,
            residentWallet: inv.residentWallet,
          })
        ) {
          const result = creditInvoice({ invoiceId: inv.invoiceId, txHash: tx.hash });
          if ("invoiceId" in result) credited += 1;
          break;
        }
      }
    }
  } catch (err) {
    console.warn("[return-walk] Server Wallet watch failed:", err);
  }
  return credited;
}

export function startReturnWalkCreditWatch(): void {
  if (watchTimer) return;
  watchTimer = setInterval(() => {
    void scanServerWalletForDeposits();
  }, WATCH_INTERVAL_MS);
  if (typeof watchTimer === "object" && "unref" in watchTimer) {
    watchTimer.unref();
  }
}

export function stopReturnWalkCreditWatch(): void {
  if (watchTimer) {
    clearInterval(watchTimer);
    watchTimer = null;
  }
}
