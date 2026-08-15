import type { UnlockPadIntentResponse } from "./api.js";
import {
  buildHubCheckoutRequest,
  isPaymentIntentUserCancel,
  sendPaymentIntentCheckout,
} from "../pay/sendPaymentIntent.js";

export type UnlockPadPaymentIntent = UnlockPadIntentResponse["intent"];

/** Hub checkout options for an Unlock Pad Payment Intent (memo required). */
export function buildUnlockPadHubCheckoutRequest(
  intent: UnlockPadPaymentIntent
): {
  appName: string;
  recipient: string;
  value: number;
  extraData: string;
} {
  return buildHubCheckoutRequest(intent);
}

export function isUnlockPadPaymentUserCancel(err: unknown): boolean {
  return isPaymentIntentUserCancel(err);
}

/**
 * Send an Unlock Pad Payment Intent: Nimiq Pay mini-app SDK when in Pay,
 * else Hub checkout. Never opens Hub while inside Nimiq Pay.
 */
export async function sendUnlockPadPaymentIntent(
  intent: UnlockPadPaymentIntent
): Promise<void> {
  return sendPaymentIntentCheckout(intent);
}
