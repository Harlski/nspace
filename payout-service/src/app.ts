import cors from "cors";
import express from "express";
import type { Server } from "node:http";
import { bearerApiAuth } from "./auth.js";
import { createNimiqChainClient } from "./chain/nimiqClient.js";
import type { ChainClient } from "./chain/types.js";
import { loadConfig, type AppConfig } from "./config.js";
import {
  enqueuePayIntent,
  flushAllPendingPayoutsNow,
  getAdminPanelSnapshot,
  getGlobalSnapshot,
  getPendingQueueTotals,
  getPublicSummary,
  getWalletSnapshot,
  initPayoutQueue,
  manualBulkPayoutPendingForRecipient,
  startPayoutProcessor,
  type PayIntentBody,
} from "./queue.js";
import {
  getWalletBalanceLuna,
  initBalanceCache,
} from "./balance.js";

export type CreatePayoutAppOptions = {
  cfg?: AppConfig;
  chainClient?: ChainClient;
  startProcessor?: boolean;
};

export function createPayoutApp(opts: CreatePayoutAppOptions = {}) {
  const cfg = opts.cfg ?? loadConfig();
  const chainClient =
    opts.chainClient ?? createNimiqChainClient(cfg.defaultTxMessage);
  initPayoutQueue(cfg, chainClient);
  initBalanceCache(chainClient, cfg.balanceCacheMs);
  if (opts.startProcessor !== false) {
    startPayoutProcessor(cfg.processIntervalMs);
  }

  const app = express();
  app.use(cors({ origin: false }));
  app.use(express.json({ limit: "64kb" }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "nspace-payout" });
  });

  const auth = bearerApiAuth(cfg);

  app.post("/v1/pay-intents", auth, (req, res) => {
    try {
      const body = req.body as PayIntentBody;
      const result = enqueuePayIntent(body);
      res.status(result.duplicate ? 200 : 201).json(result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "error";
      if (
        msg.includes("required") ||
        msg.includes("amountLuna") ||
        msg.includes("must")
      ) {
        res.status(400).json({ error: msg });
        return;
      }
      console.error("[payout-service] enqueue", e);
      res.status(500).json({ error: "internal" });
    }
  });

  app.get("/v1/balance", auth, async (_req, res) => {
    try {
      const luna = await getWalletBalanceLuna();
      res.json({ balanceLuna: luna.toString() });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "error";
      if (msg.includes("not configured") || msg.includes("not initialized")) {
        res.status(503).json({ error: msg });
        return;
      }
      console.error("[payout-service] balance", e);
      res.status(500).json({ error: "internal" });
    }
  });

  app.get("/v1/pending/totals", auth, (_req, res) => {
    res.json(getPendingQueueTotals());
  });

  app.get("/v1/pending/summary", auth, (_req, res) => {
    res.json(getPublicSummary());
  });

  app.get("/v1/pending/snapshot", auth, (req, res) => {
    const walletRaw = String(req.query.wallet ?? "").trim();
    const rawPanel = req.query.adminPanel;
    const adminPanel =
      typeof rawPanel === "string" &&
      (rawPanel === "1" || rawPanel.toLowerCase() === "true");
    if (walletRaw) {
      res.json(getWalletSnapshot(walletRaw));
      return;
    }
    if (adminPanel) {
      res.json(getAdminPanelSnapshot());
      return;
    }
    res.json(getGlobalSnapshot());
  });

  app.post("/v1/manual-bulk-payout", auth, async (req, res) => {
    try {
      const recipient = String((req.body as { recipient?: string })?.recipient ?? "").trim();
      if (!recipient) {
        res.status(400).json({ error: "missing_recipient" });
        return;
      }
      const out = await manualBulkPayoutPendingForRecipient(recipient);
      res.json(out);
    } catch (err) {
      const code = err instanceof Error ? err.message : "internal";
      if (code === "no_pending_jobs") {
        res.status(400).json({ error: code });
        return;
      }
      if (code === "wallet_payout_race_retry") {
        res.status(409).json({ error: code });
        return;
      }
      if (code === "invalid_recipient" || code === "nim_payout_not_configured") {
        res.status(400).json({ error: code });
        return;
      }
      console.error("[payout-service] manual-bulk-payout", err);
      res.status(503).json({ error: "payout_failed", detail: code });
    }
  });

  app.post("/v1/flush", auth, async (_req, res) => {
    try {
      const out = await flushAllPendingPayoutsNow();
      res.json(out);
    } catch (err) {
      console.error("[payout-service] flush", err);
      res.status(500).json({ error: "internal" });
    }
  });

  return { app, cfg, chainClient };
}

export function startPayoutService(
  opts: CreatePayoutAppOptions = {}
): { server: Server; cfg: AppConfig } {
  const { app, cfg } = createPayoutApp(opts);
  const server = app.listen(cfg.port, cfg.host, () => {
    console.log(
      `[payout-service] listening on ${cfg.host}:${cfg.port} network=${cfg.nimNetwork}`
    );
  });
  return { server, cfg };
}
