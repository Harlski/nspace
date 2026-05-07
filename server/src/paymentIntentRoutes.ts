import type { Express, Request, RequestHandler, Response } from "express";
import {
  isPaymentIntentSidecarConfigured,
  PaymentIntentSidecarError,
  sidecarCreateIntent,
  sidecarGetIntent,
  sidecarVerifyIntent,
} from "./paymentIntentClient.js";

type JwtAddressFn = (req: Request) => string | null;

/**
 * Player-facing payment intent API: proxies to the sidecar with **`payerWallet` forced from JWT `sub`**.
 */
export function registerPaymentIntentPlayerApi(
  app: Express,
  opts: {
    requireJwt: RequestHandler;
    jwtAddressFromReq: JwtAddressFn;
    normalizeWalletId: (v: string) => string;
  }
): void {
  const { requireJwt, jwtAddressFromReq, normalizeWalletId } = opts;

  app.post("/api/payment/intents", requireJwt, async (req, res) => {
    if (!isPaymentIntentSidecarConfigured()) {
      res.status(503).json({ error: "payment_intent_unavailable" });
      return;
    }
    const sub = jwtAddressFromReq(req);
    const payerWallet = normalizeWalletId(sub ?? "");
    if (!payerWallet) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const body = req.body as Record<string, unknown> | null;
    const featureKind = typeof body?.featureKind === "string" ? body.featureKind.trim() : "";
    if (!featureKind) {
      res.status(400).json({ error: "missing_feature_kind" });
      return;
    }
    const idempotencyKey =
      typeof body?.idempotencyKey === "string" ? body.idempotencyKey.trim() : undefined;
    const featurePayload =
      body && Object.prototype.hasOwnProperty.call(body, "featurePayload")
        ? body.featurePayload
        : undefined;
    try {
      const json = await sidecarCreateIntent(payerWallet, {
        featureKind,
        featurePayload,
        idempotencyKey: idempotencyKey || undefined,
      });
      res.status(201).json(json);
    } catch (e) {
      mapSidecarErrorToHttp(res, e);
    }
  });

  app.get("/api/payment/intents/:intentId", requireJwt, async (req, res) => {
    if (!isPaymentIntentSidecarConfigured()) {
      res.status(503).json({ error: "payment_intent_unavailable" });
      return;
    }
    const sub = jwtAddressFromReq(req);
    const payerWallet = normalizeWalletId(sub ?? "");
    if (!payerWallet) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const intentId = String(req.params.intentId ?? "").trim();
    if (!intentId) {
      res.status(400).json({ error: "missing_intent_id" });
      return;
    }
    try {
      const json = await sidecarGetIntent(intentId, payerWallet);
      res.json(json);
    } catch (e) {
      mapSidecarErrorToHttp(res, e);
    }
  });

  app.post("/api/payment/intents/:intentId/verify", requireJwt, async (req, res) => {
    if (!isPaymentIntentSidecarConfigured()) {
      res.status(503).json({ error: "payment_intent_unavailable" });
      return;
    }
    const sub = jwtAddressFromReq(req);
    const payerWallet = normalizeWalletId(sub ?? "");
    if (!payerWallet) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const intentId = String(req.params.intentId ?? "").trim();
    const raw = (req.body as Record<string, unknown> | null)?.txHash;
    const txHash = typeof raw === "string" ? raw.trim() : "";
    if (!intentId || !txHash) {
      res.status(400).json({ error: "missing_tx_hash_or_intent" });
      return;
    }
    try {
      const json = await sidecarVerifyIntent(intentId, payerWallet, txHash);
      res.json(json);
    } catch (e) {
      mapSidecarErrorToHttp(res, e);
    }
  });
}

function mapSidecarErrorToHttp(res: Response, e: unknown): void {
  if (e instanceof PaymentIntentSidecarError) {
    if (e.status === 400 || e.status === 404) {
      res.status(e.status).json({ error: e.message });
      return;
    }
    if (e.status === 503) {
      res.status(503).json({ error: e.message });
      return;
    }
    res.status(502).json({ error: e.message });
    return;
  }
  console.error("[api/payment]", e);
  res.status(500).json({ error: "internal" });
}
