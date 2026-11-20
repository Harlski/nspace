import { enqueuePayIntent } from "../payoutGateway.js";
import { RETURN_GOLD_LUNA } from "./constants.js";

/** Pay 1 NIM from the Server Wallet ledger (Payout Service Return Walk signer). */
export function enqueueReturnGoldPayIntent(opts: {
  claimId: string;
  recipientAddress: string;
  roomId: string;
  tileKey: string;
}): void {
  enqueuePayIntent({
    claimId: opts.claimId,
    recipientAddress: opts.recipientAddress,
    amountLuna: RETURN_GOLD_LUNA,
    roomId: opts.roomId,
    tileKey: opts.tileKey,
    txMessage: "Return Gold",
    source: "returnWalk",
  });
}
