import { randomUUID } from "node:crypto";
import type { AppConfig } from "./config.js";
import { getFeatureHandler } from "./features/registry.js";
import type { IntentStore, PaymentIntentRow } from "./store.js";
import { fetchTransactionDetails } from "./nim/client.js";
import { memoFromTransactionDetails } from "./nim/memo.js";
import { normalizeWalletId } from "./wallet.js";

const MEMO_PREFIX = "NSPACE:pi:";

export type CreateIntentBody = {
  featureKind: string;
  featurePayload?: unknown;
  payerWallet: string;
  idempotencyKey?: string;
};

export type PublicIntent = {
  intentId: string;
  featureKind: string;
  payerWallet: string;
  amountLuna: string;
  recipient: string;
  memo: string;
  expiresAt: string;
  status: PaymentIntentRow["status"];
  createdAt: string;
  verifiedTxHash: string | null;
  failureReason: string | null;
};

function rowToPublic(row: PaymentIntentRow): PublicIntent {
  return {
    intentId: row.id,
    featureKind: row.feature_kind,
    payerWallet: row.payer_wallet,
    amountLuna: row.amount_luna,
    recipient: row.recipient_address,
    memo: row.memo,
    expiresAt: new Date(row.expires_at_ms).toISOString(),
    status: row.status,
    createdAt: new Date(row.created_at_ms).toISOString(),
    verifiedTxHash: row.verified_tx_hash,
    failureReason: row.failure_reason,
  };
}

function assertFresh(row: PaymentIntentRow, store: IntentStore): PaymentIntentRow {
  const now = Date.now();
  if (row.expires_at_ms <= now && row.status === "pending") {
    store.updateStatus(row.id, "expired", { failure_reason: "Intent TTL elapsed" });
    const next = store.findById(row.id);
    return next ?? row;
  }
  return row;
}

export async function validateRecipientAddress(address: string): Promise<void> {
  const Nimiq = await import("@nimiq/core");
  Nimiq.Address.fromUserFriendlyAddress(address.trim());
}

export async function createIntent(
  store: IntentStore,
  cfg: AppConfig,
  body: CreateIntentBody
): Promise<PublicIntent> {
  const featureKind = String(body.featureKind || "").trim();
  if (!featureKind) throw new Error("featureKind is required");

  const payerWallet = normalizeWalletId(String(body.payerWallet || ""));
  if (!payerWallet) throw new Error("payerWallet is required");

  const idem = body.idempotencyKey?.trim();
  if (idem) {
    const existing = store.findIdempotent(payerWallet, featureKind, idem);
    if (existing) {
      const row = assertFresh(existing, store);
      if (row.status === "expired" || row.status === "failed") {
        store.deleteIntent(row.id);
      } else {
        return rowToPublic(row);
      }
    }
  }

  const handler = getFeatureHandler(featureKind);
  if (!handler) {
    throw new Error(`Unknown featureKind: ${featureKind}`);
  }
  if (handler.validatePayload) handler.validatePayload(body.featurePayload);

  const quote = await handler.quote({
    featureKind,
    featurePayload: body.featurePayload,
    payerWallet,
  });

  const rawRecipient = cfg.recipientAddress.trim();
  await validateRecipientAddress(rawRecipient);

  const intentId = randomUUID();
  const memo = `${MEMO_PREFIX}${intentId}`;
  const memoBytes = Buffer.from(memo, "utf8");
  if (memoBytes.length > 64) {
    throw new Error("Memo exceeds 64-byte Nimiq basic-account data limit");
  }

  const now = Date.now();
  const row: Omit<PaymentIntentRow, "verified_tx_hash" | "failure_reason"> = {
    id: intentId,
    feature_kind: featureKind,
    feature_payload: JSON.stringify(body.featurePayload ?? null),
    payer_wallet: payerWallet,
    amount_luna: quote.amountLuna.toString(),
    recipient_address: normalizeWalletId(rawRecipient),
    memo,
    status: "pending",
    idempotency_key: idem || null,
    created_at_ms: now,
    expires_at_ms: now + cfg.intentTtlMs,
    updated_at_ms: now,
    quote_metadata: quote.quoteMetadata
      ? JSON.stringify(quote.quoteMetadata)
      : null,
  };

  store.insertIntent(row);
  const inserted = store.findById(intentId);
  if (!inserted) throw new Error("Failed to read intent after insert");
  return rowToPublic(inserted);
}

export type VerifyResult =
  | { ok: true; intent: PublicIntent }
  | { ok: false; intent: PublicIntent; chainMessage: string };

export async function verifyIntentTx(
  store: IntentStore,
  cfg: AppConfig,
  intentId: string,
  txHash: string
): Promise<VerifyResult> {
  const hash = String(txHash || "").trim();
  if (!hash) throw new Error("txHash is required");

  const row = store.findById(intentId.trim());
  if (!row) throw new Error("Intent not found");

  const live = assertFresh(row, store);
  if (live.status === "expired" || live.status === "failed") {
    return {
      ok: false,
      intent: rowToPublic(live),
      chainMessage: live.failure_reason || "Intent not payable",
    };
  }
  if (live.status === "confirmed") {
    return { ok: true, intent: rowToPublic(live) };
  }

  const other = store.findByVerifiedTx(hash);
  if (other && other.id !== live.id) {
    const msg = "This transaction hash is already bound to another intent";
    store.updateStatus(live.id, "failed", { failure_reason: msg });
    const failed = store.findById(live.id)!;
    return { ok: false, intent: rowToPublic(failed), chainMessage: msg };
  }

  const details = await fetchTransactionDetails(hash, {
    network: cfg.nimNetwork,
    logLevel: cfg.nimClientLogLevel,
  });

  const fail = (reason: string) => {
    store.updateStatus(live.id, "failed", { failure_reason: reason });
    const failed = store.findById(live.id)!;
    return { ok: false, intent: rowToPublic(failed), chainMessage: reason } as const;
  };

  if (details.state === "invalidated" || details.state === "expired") {
    return fail(`Transaction state: ${details.state}`);
  }

  if (details.state === "new" || details.state === "pending") {
    store.updateStatus(live.id, "confirming", {});
    const next = store.findById(live.id)!;
    return {
      ok: false,
      intent: rowToPublic(next),
      chainMessage: "Transaction not included yet; retry verify after propagation",
    };
  }

  const recipient = normalizeWalletId(details.recipient);
  const expectedRecipient = normalizeWalletId(live.recipient_address);
  if (recipient !== expectedRecipient) {
    return fail("Recipient address does not match payment intent");
  }

  const sender = normalizeWalletId(details.sender);
  if (sender !== live.payer_wallet) {
    return fail("Sender does not match intent payerWallet");
  }

  const valueLuna = BigInt(String(details.value ?? 0));
  const required = BigInt(live.amount_luna);
  if (valueLuna < required) {
    return fail(`Insufficient value: got ${valueLuna} luna, need >= ${required}`);
  }

  const memo = memoFromTransactionDetails(details);
  if (memo !== live.memo) {
    return fail("Transaction memo/data does not match intent memo");
  }

  const conf = Number(details.confirmations ?? 0);
  if (conf < cfg.minConfirmations) {
    store.updateStatus(live.id, "confirming", {});
    const next = store.findById(live.id)!;
    return {
      ok: false,
      intent: rowToPublic(next),
      chainMessage: `Need >= ${cfg.minConfirmations} confirmations (have ${conf})`,
    };
  }

  store.updateStatus(live.id, "confirmed", { verified_tx_hash: hash });
  const done = store.findById(live.id)!;
  return { ok: true, intent: rowToPublic(done) };
}

export function getIntent(store: IntentStore, intentId: string): PublicIntent | null {
  const row = store.findById(intentId.trim());
  if (!row) return null;
  return rowToPublic(assertFresh(row, store));
}
