import {
  checkPaymentIntent,
  createUnlockPadIntent,
  getPaymentIntent,
  isPaymentIntentClientConfigured,
  type PublicPaymentIntent,
} from "../paymentIntentClient.js";
import {
  hasUnlockPadGrant,
  recordUnlockPadGrant,
  type UnlockPadConfig,
} from "./index.js";

function normalizeWallet(v: string): string {
  return String(v || "")
    .replace(/\s+/g, "")
    .toUpperCase();
}

export type UnlockPadLookup = (
  roomId: string,
  instanceId: string
) => UnlockPadConfig | null;

let padLookup: UnlockPadLookup = () => null;

/** Rooms registers the live obstacle lookup so fulfill stays free of rooms imports. */
export function setUnlockPadLookup(fn: UnlockPadLookup): void {
  padLookup = fn;
}

export async function createUnlockPadPaymentIntent(
  wallet: string,
  roomId: string,
  instanceId: string
): Promise<
  | { ok: true; config: UnlockPadConfig; intent: PublicPaymentIntent }
  | { ok: false; error: string }
> {
  if (!isPaymentIntentClientConfigured()) {
    return { ok: false, error: "payment_intent_not_configured" };
  }
  const w = normalizeWallet(wallet);
  const rid = String(roomId ?? "")
    .trim()
    .toLowerCase();
  const iid = String(instanceId ?? "").trim();
  if (!w || !rid || !iid) return { ok: false, error: "invalid_request" };

  const cfg = padLookup(rid, iid);
  if (!cfg) return { ok: false, error: "pad_not_found" };
  if (cfg.proofMode !== "payment_intent") {
    return { ok: false, error: "wrong_proof_mode" };
  }
  if (hasUnlockPadGrant(w, rid, iid)) {
    return { ok: false, error: "already_unlocked" };
  }

  let amountLuna: bigint;
  try {
    amountLuna = BigInt(cfg.amountLuna);
  } catch {
    return { ok: false, error: "invalid_amount" };
  }
  if (amountLuna < 1n) return { ok: false, error: "invalid_amount" };

  const created = await createUnlockPadIntent({
    payerWallet: w,
    roomId: rid,
    instanceId: iid,
    amountLuna,
    idempotencyKey: `unlock-pad:${rid}:${iid}:${w}`,
  });
  if (!created.ok) return { ok: false, error: created.error };
  return { ok: true, config: cfg, intent: created.intent };
}

export async function confirmUnlockPadPayment(
  wallet: string,
  intentId: string,
  roomId: string,
  instanceId: string
): Promise<
  | { ok: true; granted: boolean; instanceId: string }
  | { ok: false; error: string; pending?: boolean }
> {
  const w = normalizeWallet(wallet);
  const id = String(intentId ?? "").trim();
  const rid = String(roomId ?? "")
    .trim()
    .toLowerCase();
  const iid = String(instanceId ?? "").trim();
  if (!w || !id || !rid || !iid) return { ok: false, error: "invalid_request" };
  if (!isPaymentIntentClientConfigured()) {
    return { ok: false, error: "payment_intent_not_configured" };
  }

  const cfg = padLookup(rid, iid);
  if (!cfg) return { ok: false, error: "pad_not_found" };
  if (cfg.proofMode !== "payment_intent") {
    return { ok: false, error: "wrong_proof_mode" };
  }

  let intentStatus = await getPaymentIntent(id);
  if (!intentStatus.ok) {
    return { ok: false, error: intentStatus.error, pending: true };
  }
  let intent = intentStatus.intent;
  if (intent.status !== "confirmed") {
    const checked = await checkPaymentIntent(id);
    if (!checked.ok) {
      return {
        ok: false,
        error: checked.error,
        pending: intent.status === "pending" || intent.status === "created",
      };
    }
    intent = checked.intent;
  }
  if (intent.status !== "confirmed") {
    return { ok: false, error: "payment_pending", pending: true };
  }
  if (intent.featureKind !== "nspace.unlock_pad") {
    return { ok: false, error: "wrong_feature_kind" };
  }
  if (normalizeWallet(intent.payerWallet) !== w) {
    return { ok: false, error: "payer_mismatch" };
  }

  let quoted: bigint;
  let expected: bigint;
  try {
    quoted = BigInt(intent.amountLuna);
    expected = BigInt(cfg.amountLuna);
  } catch {
    return { ok: false, error: "invalid_amount" };
  }
  if (quoted !== expected) {
    return { ok: false, error: "amount_mismatch" };
  }

  const granted = recordUnlockPadGrant({
    wallet: w,
    roomId: rid,
    instanceId: iid,
  });
  if (!granted.ok) return { ok: false, error: granted.error };
  return {
    ok: true,
    granted: !granted.idempotent,
    instanceId: iid,
  };
}
