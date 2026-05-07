import cors from "cors";
import express from "express";
import { loadConfig } from "./config.js";
import { bearerApiAuth } from "./auth.js";
import { registerBuiltinFeatureHandlers } from "./features/builtin.js";
import { listRegisteredFeatureKinds } from "./features/registry.js";
import {
  createIntent,
  getIntent,
  verifyIntentTx,
  type CreateIntentBody,
} from "./intents.js";
import { IntentStore } from "./store.js";

registerBuiltinFeatureHandlers();

const cfg = loadConfig();
const store = new IntentStore(cfg.sqlitePath);

const app = express();
app.use(cors({ origin: false }));
app.use(express.json({ limit: "64kb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "nspace-payment-intent" });
});

const auth = bearerApiAuth(cfg);

app.get("/v1/meta/features", auth, (_req, res) => {
  res.json({ featureKinds: listRegisteredFeatureKinds() });
});

app.post("/v1/intents", auth, async (req, res) => {
  try {
    const body = req.body as CreateIntentBody;
    const intent = await createIntent(store, cfg, body);
    res.status(201).json({ intent });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    if (
      msg.startsWith("Unknown featureKind") ||
      msg.includes("required") ||
      msg.includes("Invalid") ||
      msg.includes("must be")
    ) {
      res.status(400).json({ error: msg });
      return;
    }
    console.error("[payment-intent] create", e);
    res.status(500).json({ error: "internal" });
  }
});

app.get("/v1/intents/:intentId", auth, (req, res) => {
  const intent = getIntent(store, req.params.intentId ?? "");
  if (!intent) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  res.json({ intent });
});

app.post("/v1/intents/:intentId/verify", auth, async (req, res) => {
  try {
    const txHash = String((req.body as { txHash?: string })?.txHash ?? "");
    const result = await verifyIntentTx(
      store,
      cfg,
      req.params.intentId ?? "",
      txHash
    );
    res.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    if (msg === "Intent not found") {
      res.status(404).json({ error: msg });
      return;
    }
    if (msg === "txHash is required") {
      res.status(400).json({ error: msg });
      return;
    }
    console.error("[payment-intent] verify", e);
    res.status(500).json({ error: "internal" });
  }
});

app.listen(cfg.port, () => {
  console.log(
    `[payment-intent] listening on :${cfg.port} network=${cfg.nimNetwork}`
  );
});
