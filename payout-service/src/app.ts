import cors from "cors";
import express from "express";
import type { Server } from "node:http";
import { bearerApiAuth } from "./auth.js";
import { createNimiqChainClient } from "./chain/nimiqClient.js";
import type { ChainClient } from "./chain/types.js";
import { loadConfig, type AppConfig } from "./config.js";
import {
  enqueuePayIntent,
  initPayoutQueue,
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
