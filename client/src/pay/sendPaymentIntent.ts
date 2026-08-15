import HubApi from "@nimiq/hub-api";
import {
  sendBasicTransactionWithDataViaPay,
  shouldUseNimiqPaySend,
} from "./sendBasicWithData.js";

const HUB_URL = import.meta.env.VITE_HUB_URL || "https://hub.nimiq.com";

/** Minimal fields required to open Hub checkout or Nimiq Pay send. */
export type PaymentIntentCheckoutFields = {
  recipient: string;
  amountLuna: string;
  memo: string;
};

/** Hub checkout options for a Payment Intent (memo required as extraData). */
export function buildHubCheckoutRequest(intent: PaymentIntentCheckoutFields): {
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

export function isPaymentIntentUserCancel(err: unknown): boolean {
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
 * Send a Payment Intent: Nimiq Pay mini-app SDK when in Pay, else Hub checkout.
 * Never opens Hub while inside Nimiq Pay.
 */
export async function sendPaymentIntentCheckout(
  intent: PaymentIntentCheckoutFields
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
  await hub.checkout(buildHubCheckoutRequest(intent));
}

export function paymentIntentOpeningStatus(): string {
  return shouldUseNimiqPaySend() ? "Opening wallet…" : "Opening Nimiq Hub…";
}
