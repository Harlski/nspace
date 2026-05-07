import { registerFeatureHandler } from "./registry.js";
import type { FeatureQuoteInput, PaymentFeatureHandler } from "./types.js";

const LUNA_PER_NIM = 100_000n;

function readBigIntLuna(v: unknown, field: string): bigint {
  if (typeof v === "bigint") return v;
  if (typeof v === "number" && Number.isFinite(v) && v >= 0 && v === Math.floor(v)) {
    return BigInt(v);
  }
  if (typeof v === "string" && /^\d+$/.test(v)) return BigInt(v);
  throw new Error(`Invalid ${field}: expected non-negative integer luna`);
}

/**
 * Minimal amount for manual / integration tests (default 1 NIM).
 * Override with `featurePayload.amountLuna` (string or number).
 */
const testMinHandler: PaymentFeatureHandler = {
  kind: "nspace.test.min",
  validatePayload(payload) {
    if (payload !== null && typeof payload !== "object") {
      throw new Error("featurePayload must be an object or null");
    }
  },
  quote(input: FeatureQuoteInput) {
    const o = (input.featurePayload ?? {}) as Record<string, unknown>;
    const raw = o["amountLuna"];
    const amountLuna =
      raw === undefined || raw === null
        ? LUNA_PER_NIM
        : readBigIntLuna(raw, "amountLuna");
    if (amountLuna < 1n) throw new Error("amountLuna must be >= 1");
    return { amountLuna, quoteMetadata: { tier: "test" } };
  },
};

function notImplemented(kind: string): PaymentFeatureHandler {
  return {
    kind,
    quote() {
      throw new Error(
        `Payment feature "${kind}" is reserved but not implemented yet.`
      );
    },
  };
}

export function registerBuiltinFeatureHandlers(): void {
  registerFeatureHandler(testMinHandler);
  registerFeatureHandler(notImplemented("nspace.username.exclusive"));
  registerFeatureHandler(notImplemented("nspace.billboard.slot"));
  registerFeatureHandler(notImplemented("nspace.teleporter.purchase"));
  registerFeatureHandler(notImplemented("nspace.land.grant"));
}
