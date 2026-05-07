import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

export type IntentStatus =
  | "pending"
  | "confirming"
  | "confirmed"
  | "failed"
  | "expired";

export type PaymentIntentRow = {
  id: string;
  feature_kind: string;
  feature_payload: string;
  payer_wallet: string;
  amount_luna: string;
  recipient_address: string;
  memo: string;
  status: IntentStatus;
  idempotency_key: string | null;
  verified_tx_hash: string | null;
  created_at_ms: number;
  expires_at_ms: number;
  updated_at_ms: number;
  failure_reason: string | null;
  quote_metadata: string | null;
};

export class IntentStore {
  readonly db: Database.Database;

  constructor(sqlitePath: string) {
    if (sqlitePath !== ":memory:") {
      const dir = path.dirname(path.resolve(sqlitePath));
      fs.mkdirSync(dir, { recursive: true });
    }
    this.db = new Database(sqlitePath);
    this.db.pragma("journal_mode = WAL");
    this.migrate();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS payment_intents (
        id TEXT PRIMARY KEY,
        feature_kind TEXT NOT NULL,
        feature_payload TEXT NOT NULL,
        payer_wallet TEXT NOT NULL,
        amount_luna TEXT NOT NULL,
        recipient_address TEXT NOT NULL,
        memo TEXT NOT NULL,
        status TEXT NOT NULL,
        idempotency_key TEXT,
        verified_tx_hash TEXT,
        created_at_ms INTEGER NOT NULL,
        expires_at_ms INTEGER NOT NULL,
        updated_at_ms INTEGER NOT NULL,
        failure_reason TEXT,
        quote_metadata TEXT
      );
      CREATE UNIQUE INDEX IF NOT EXISTS ux_payment_intent_verified_tx
        ON payment_intents(verified_tx_hash)
        WHERE verified_tx_hash IS NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS ux_payment_intent_idempotency
        ON payment_intents(payer_wallet, feature_kind, idempotency_key)
        WHERE idempotency_key IS NOT NULL AND idempotency_key != '';
    `);
  }

  findById(id: string): PaymentIntentRow | undefined {
    return this.db
      .prepare(`SELECT * FROM payment_intents WHERE id = ?`)
      .get(id) as PaymentIntentRow | undefined;
  }

  findIdempotent(
    payerWallet: string,
    featureKind: string,
    idempotencyKey: string
  ): PaymentIntentRow | undefined {
    return this.db
      .prepare(
        `SELECT * FROM payment_intents
         WHERE payer_wallet = ? AND feature_kind = ? AND idempotency_key = ?`
      )
      .get(payerWallet, featureKind, idempotencyKey) as PaymentIntentRow | undefined;
  }

  findByVerifiedTx(txHash: string): PaymentIntentRow | undefined {
    return this.db
      .prepare(`SELECT * FROM payment_intents WHERE verified_tx_hash = ?`)
      .get(txHash) as PaymentIntentRow | undefined;
  }

  insertIntent(row: Omit<PaymentIntentRow, "verified_tx_hash" | "failure_reason"> & {
    verified_tx_hash?: null;
    failure_reason?: null;
  }): void {
    this.db
      .prepare(
        `INSERT INTO payment_intents (
          id, feature_kind, feature_payload, payer_wallet, amount_luna,
          recipient_address, memo, status, idempotency_key, verified_tx_hash,
          created_at_ms, expires_at_ms, updated_at_ms, failure_reason, quote_metadata
        ) VALUES (
          @id, @feature_kind, @feature_payload, @payer_wallet, @amount_luna,
          @recipient_address, @memo, @status, @idempotency_key, NULL,
          @created_at_ms, @expires_at_ms, @updated_at_ms, NULL, @quote_metadata
        )`
      )
      .run({
        ...row,
        idempotency_key: row.idempotency_key,
        quote_metadata: row.quote_metadata,
      });
  }

  deleteIntent(id: string): void {
    this.db.prepare(`DELETE FROM payment_intents WHERE id = ?`).run(id);
  }

  updateStatus(
    id: string,
    status: IntentStatus,
    patch: { failure_reason?: string | null; verified_tx_hash?: string | null }
  ): void {
    const sets = ["status = ?", "updated_at_ms = ?"];
    const vals: (string | number | null)[] = [status, Date.now()];
    if ("failure_reason" in patch) {
      sets.push("failure_reason = ?");
      vals.push(patch.failure_reason ?? null);
    }
    if ("verified_tx_hash" in patch) {
      sets.push("verified_tx_hash = ?");
      vals.push(patch.verified_tx_hash ?? null);
    }
    vals.push(id);
    this.db.prepare(`UPDATE payment_intents SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
  }

  close(): void {
    this.db.close();
  }
}
