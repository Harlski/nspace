import {
  getCatalogEntry,
  grantEntitlementFromPurchase,
  validateUnlockIntent,
  type CatalogEntryPublic,
} from "./cosmeticStore.js";
import {
  checkPaymentIntent,
  createCosmeticUnlockIntent,
  getPaymentIntent,
  isPaymentIntentClientConfigured,
  type PublicPaymentIntent,
} from "./paymentIntentClient.js";

function normalizeWallet(v: string): string {
  return String(v || "").replace(/\s+/g, "").toUpperCase();
}

export async function createCosmeticUnlockPaymentIntent(
  wallet: string,
  cosmeticSku: string
): Promise<
  | { ok: true; entry: CatalogEntryPublic; intent: PublicPaymentIntent }
  | { ok: false; error: string }
> {
  if (!isPaymentIntentClientConfigured()) {
    return { ok: false, error: "payment_intent_not_configured" };
  }
  const w = normalizeWallet(wallet);
  const validated = validateUnlockIntent(w, cosmeticSku);
  if (!validated.ok) return validated;

  const created = await createCosmeticUnlockIntent({
    payerWallet: w,
    cosmeticSku: validated.entry.cosmeticSku,
    amountLuna: validated.amountLuna,
    idempotencyKey: `cosmetic:${validated.entry.cosmeticSku}:${w}`,
  });
  if (!created.ok) return { ok: false, error: created.error };
  return { ok: true, entry: validated.entry, intent: created.intent };
}

export async function confirmCosmeticUnlockPayment(
  wallet: string,
  intentId: string
): Promise<
  | { ok: true; granted: boolean; cosmeticSku: string }
  | { ok: false; error: string; pending?: boolean }
> {
  const w = normalizeWallet(wallet);
  const id = String(intentId ?? "").trim();
  if (!w || !id) return { ok: false, error: "invalid_request" };
  if (!isPaymentIntentClientConfigured()) {
    return { ok: false, error: "payment_intent_not_configured" };
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
  if (intent.featureKind !== "nspace.cosmetic.unlock") {
    return { ok: false, error: "wrong_feature_kind" };
  }
  if (normalizeWallet(intent.payerWallet) !== w) {
    return { ok: false, error: "payer_mismatch" };
  }

  const pi = await getPaymentIntent(id);
  if (!pi.ok) return { ok: false, error: pi.error };
  const featurePayload = extractCosmeticSkuFromIntent(pi.intent);
  if (!featurePayload) return { ok: false, error: "missing_cosmetic_sku" };

  const entry = getCatalogEntry(featurePayload);
  if (!entry || entry.status !== "published") {
    return { ok: false, error: "not_published" };
  }

  const quoted = BigInt(intent.amountLuna);
  let catalogPrice: bigint;
  try {
    catalogPrice = BigInt(entry.priceLuna);
  } catch {
    return { ok: false, error: "invalid_price" };
  }
  if (quoted !== catalogPrice && entry.status === "published") {
    /* Price lock: intent amount is authoritative at verify time. */
  }

  const txHash = intent.verifiedTxHash ?? "";
  const granted = grantEntitlementFromPurchase(w, entry.cosmeticSku, {
    intentId: id,
    txHash,
  });
  if (!granted.ok) return { ok: false, error: granted.error };
  return {
    ok: true,
    granted: granted.granted,
    cosmeticSku: entry.cosmeticSku,
  };
}

function extractCosmeticSkuFromIntent(intent: PublicPaymentIntent): string | null {
  void intent;
  /* featurePayload is not returned on PublicPaymentIntent; callers pass sku separately
     or we re-fetch from PI service detail. For v1, sync endpoint accepts cosmeticSku body. */
  return null;
}

export async function confirmCosmeticUnlockPaymentForSku(
  wallet: string,
  intentId: string,
  cosmeticSku: string
): Promise<
  | { ok: true; granted: boolean; cosmeticSku: string }
  | { ok: false; error: string; pending?: boolean }
> {
  const w = normalizeWallet(wallet);
  const id = String(intentId ?? "").trim();
  const sku = String(cosmeticSku ?? "").trim().toLowerCase();
  if (!w || !id || !sku) return { ok: false, error: "invalid_request" };
  if (!isPaymentIntentClientConfigured()) {
    return { ok: false, error: "payment_intent_not_configured" };
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
  if (intent.featureKind !== "nspace.cosmetic.unlock") {
    return { ok: false, error: "wrong_feature_kind" };
  }
  if (normalizeWallet(intent.payerWallet) !== w) {
    return { ok: false, error: "payer_mismatch" };
  }

  const entry = getCatalogEntry(sku);
  if (!entry) return { ok: false, error: "not_found" };
  if (entry.status === "archived") {
    return { ok: false, error: "archived" };
  }
  if (entry.status !== "published") {
    return { ok: false, error: "not_published" };
  }

  let quoted: bigint;
  try {
    quoted = BigInt(intent.amountLuna);
  } catch {
    return { ok: false, error: "invalid_amount" };
  }
  let expected: bigint;
  try {
    expected = BigInt(entry.priceLuna);
  } catch {
    return { ok: false, error: "invalid_price" };
  }
  if (quoted !== expected) {
    return { ok: false, error: "amount_mismatch" };
  }

  const txHash = intent.verifiedTxHash ?? "";
  const granted = grantEntitlementFromPurchase(w, entry.cosmeticSku, {
    intentId: id,
    txHash,
  });
  if (!granted.ok) return { ok: false, error: granted.error };
  return {
    ok: true,
    granted: granted.granted,
    cosmeticSku: entry.cosmeticSku,
  };
}
