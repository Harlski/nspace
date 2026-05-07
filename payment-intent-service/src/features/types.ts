export type JsonObject = Record<string, unknown>;

export type FeatureQuoteInput = {
  featureKind: string;
  featurePayload: unknown;
  payerWallet: string;
};

export type FeatureQuoteResult = {
  /** Gross amount the payer must send to the hot wallet (luna). */
  amountLuna: bigint;
  /** Optional opaque metadata stored on the intent (e.g. SKU breakdown). */
  quoteMetadata?: JsonObject;
};

/**
 * Pluggable per–feature-kind pricing and payload validation.
 * Register new kinds in `builtin.ts` (or future modules) as product areas ship.
 */
export interface PaymentFeatureHandler {
  readonly kind: string;
  quote(input: FeatureQuoteInput): FeatureQuoteResult | Promise<FeatureQuoteResult>;
  /** Optional JSON-schema–light validation before quote. */
  validatePayload?(payload: unknown): void;
}
