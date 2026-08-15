/**
 * Cosmetic Unlock checkout: create Payment Intent → open Pay/Hub → poll sync.
 * Mirrors Unlock Pad; no memo clipboard fallback.
 */
import {
  createUnlockIntent,
  syncUnlockPayment,
  type UnlockIntentWire,
} from "./api.js";
import {
  isPaymentIntentUserCancel,
  paymentIntentOpeningStatus,
  sendPaymentIntentCheckout,
} from "../pay/sendPaymentIntent.js";

export type CosmeticUnlockCheckoutResult =
  | { ok: true }
  | { ok: false; reason: "cancelled" | "timeout" | "error"; message: string };

export async function runCosmeticUnlockCheckout(
  cosmeticSku: string,
  onStatus?: (message: string) => void
): Promise<CosmeticUnlockCheckoutResult> {
  let intent: UnlockIntentWire;
  try {
    const created = await createUnlockIntent(cosmeticSku);
    intent = created.intent;
  } catch (e) {
    const message = String((e as Error)?.message ?? e);
    return { ok: false, reason: "error", message };
  }

  onStatus?.(paymentIntentOpeningStatus());
  try {
    await sendPaymentIntentCheckout(intent);
  } catch (e) {
    if (isPaymentIntentUserCancel(e)) {
      return {
        ok: false,
        reason: "cancelled",
        message: "Payment cancelled.",
      };
    }
    const err = String((e as Error)?.message ?? e);
    if (
      err === "missing_memo" ||
      err === "missing_recipient" ||
      err === "invalid_amount"
    ) {
      return {
        ok: false,
        reason: "error",
        message: "Could not open payment (invalid intent).",
      };
    }
    return {
      ok: false,
      reason: "error",
      message: "Could not open payment. Try again.",
    };
  }

  onStatus?.("Confirming payment…");
  for (let attempt = 0; attempt < 40; attempt++) {
    await new Promise((r) => setTimeout(r, 3000));
    try {
      const synced = await syncUnlockPayment(intent.intentId, cosmeticSku);
      if (synced.granted) {
        return { ok: true };
      }
    } catch {
      /* keep polling until timeout — pending is expected */
    }
  }
  return {
    ok: false,
    reason: "timeout",
    message: "Still waiting for payment. Try again once it confirms.",
  };
}
