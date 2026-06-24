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

/** Paid in-world Hub billboard slot (fulfilled by game server after verify). */
const billboardSlotHandler: PaymentFeatureHandler = {
  kind: "nspace.billboard.slot",
  validatePayload(payload) {
    if (payload !== null && typeof payload !== "object") {
      throw new Error("featurePayload must be an object or null");
    }
    const o = (payload ?? {}) as Record<string, unknown>;
    const campaignId = String(o.campaignId ?? "").trim();
    if (!campaignId) throw new Error("featurePayload.campaignId is required");
  },
  quote(input: FeatureQuoteInput) {
    const o = (input.featurePayload ?? {}) as Record<string, unknown>;
    const payloadLuna = o["amountLuna"];
    let amountLuna: bigint;
    if (payloadLuna !== undefined && payloadLuna !== null) {
      amountLuna = readBigIntLuna(payloadLuna, "amountLuna");
    } else {
      const raw = process.env.BILLBOARD_SLOT_NIM_LUNA?.trim();
      amountLuna = LUNA_PER_NIM * 10n;
      if (raw && /^\d+$/.test(raw)) {
        amountLuna = BigInt(raw);
      } else {
        const nim = process.env.BILLBOARD_SLOT_NIM?.trim();
        if (nim && /^\d+$/.test(nim)) {
          amountLuna = BigInt(nim) * LUNA_PER_NIM;
        }
      }
    }
    if (amountLuna < 1n) throw new Error("amountLuna must be >= 1");
    const campaignId = String(o.campaignId ?? "").trim();
    return {
      amountLuna,
      quoteMetadata: { campaignId, tier: "billboard_slot" },
    };
  },
};

/** Paid cosmetic unlock (fulfilled by game server after verify). */
const cosmeticUnlockHandler: PaymentFeatureHandler = {
  kind: "nspace.cosmetic.unlock",
  validatePayload(payload) {
    if (payload !== null && typeof payload !== "object") {
      throw new Error("featurePayload must be an object or null");
    }
    const o = (payload ?? {}) as Record<string, unknown>;
    const cosmeticSku = String(o.cosmeticSku ?? "").trim();
    if (!cosmeticSku) throw new Error("featurePayload.cosmeticSku is required");
  },
  quote(input: FeatureQuoteInput) {
    const o = (input.featurePayload ?? {}) as Record<string, unknown>;
    const payloadLuna = o["amountLuna"];
    if (payloadLuna === undefined || payloadLuna === null) {
      throw new Error("featurePayload.amountLuna is required for cosmetic unlock");
    }
    const amountLuna = readBigIntLuna(payloadLuna, "amountLuna");
    if (amountLuna < 1n) throw new Error("amountLuna must be >= 1");
    const cosmeticSku = String(o.cosmeticSku ?? "").trim();
    return {
      amountLuna,
      quoteMetadata: { cosmeticSku, tier: "cosmetic_unlock" },
    };
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
  registerFeatureHandler(billboardSlotHandler);
  registerFeatureHandler(cosmeticUnlockHandler);
  registerFeatureHandler(notImplemented("nspace.teleporter.purchase"));
  registerFeatureHandler(notImplemented("nspace.land.grant"));
}
