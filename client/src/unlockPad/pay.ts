import HubApi from "@nimiq/hub-api";
import type { UnlockPadIntentResponse } from "./api.js";
import {
  sendBasicTransactionWithDataViaPay,
  shouldUseNimiqPaySend,
} from "../pay/sendBasicWithData.js";

const HUB_URL = import.meta.env.VITE_HUB_URL || "https://hub.nimiq.com";

export type UnlockPadPaymentIntent = UnlockPadIntentResponse["intent"];

/** Hub checkout options for an Unlock Pad Payment Intent (memo required). */
export function buildUnlockPadHubCheckoutRequest(intent: UnlockPadPaymentIntent): {
  appName: string;
  recipient: string;
  value: number;
  extraData: string;
} {
  const memo = String(intent.memo ?? "").trim();
  if (!memo) throw new Error("missing_memo");
  const recipient = String(intent.recipient ?? "").trim();
  if (!recipient) throw new Error("missing_recipient");
  const luna = Number(String(intent.amountLuna ?? "").trim());
  if (!Number.isFinite(luna) || luna < 1) throw new Error("invalid_amount");
  return {
    appName: "Nimiq Space",
    recipient,
    value: Math.floor(luna),
    extraData: memo,
  };
}

export function isUnlockPadPaymentUserCancel(err: unknown): boolean {
  const msg = String(err ?? "").toLowerCase();
  return (
    msg.includes("cancel") ||
    msg.includes("abort") ||
    msg.includes("denied") ||
    msg.includes("reject") ||
    msg.includes("dismiss") ||
    msg.includes("closed")
  );
}

/**
 * Send an Unlock Pad Payment Intent: Nimiq Pay mini-app SDK when in Pay,
 * else Hub checkout. Never opens Hub while inside Nimiq Pay.
 */
export async function sendUnlockPadPaymentIntent(
  intent: UnlockPadPaymentIntent
): Promise<void> {
  if (shouldUseNimiqPaySend()) {
    await sendBasicTransactionWithDataViaPay({
      recipient: intent.recipient,
      amountLuna: intent.amountLuna,
      memo: intent.memo,
    });
    return;
  }

  const hub = new HubApi(HUB_URL);
  await hub.checkout(buildUnlockPadHubCheckoutRequest(intent));
}
