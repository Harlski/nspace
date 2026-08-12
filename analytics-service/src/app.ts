import cors from "cors";
import express from "express";
import type { Server } from "node:http";
import { bearerApiAuth } from "./auth.js";
import { loadConfig, type AnalyticsServiceConfig } from "./config.js";
import {
  getDailyStatsAggregate,
  getEventLogAnalyticsSnapshot,
  type AnalyticsTimeWindow,
} from "./eventLogAnalytics.js";

export type CreateAnalyticsAppOptions = {
  cfg?: AnalyticsServiceConfig;
};

function parseTimeWindow(q: {
  fromTs?: unknown;
  toTs?: unknown;
}): AnalyticsTimeWindow | undefined {
  const fromRaw = Number(q.fromTs);
  const toRaw = Number(q.toTs);
  const fromTs = Number.isFinite(fromRaw) ? fromRaw : undefined;
  const toTs = Number.isFinite(toRaw) ? toRaw : undefined;
  if (fromTs == null && toTs == null) return undefined;
  return { fromTs, toTs };
}

export function createAnalyticsApp(opts: CreateAnalyticsAppOptions = {}) {
  const cfg = opts.cfg ?? loadConfig();
  process.env.EVENT_LOG_DIR = cfg.eventLogDir;

  const app = express();
  app.use(cors({ origin: false }));
  app.use(express.json({ limit: "16kb" }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "nspace-analytics" });
  });

  const auth = bearerApiAuth(cfg);

  app.get("/v1/overview", auth, async (req, res) => {
    const maxDays = Math.min(30, Math.max(1, Number(req.query.days) || 7));
    const sessionLimit = Math.min(1000, Math.max(1, Number(req.query.sessions) || 300));
    const payoutLimit = Math.min(1000, Math.max(1, Number(req.query.payouts) || 300));
    const timeWindow = parseTimeWindow(req.query);
    try {
      const analytics = await getEventLogAnalyticsSnapshot(
        maxDays,
        sessionLimit,
        payoutLimit,
        timeWindow
      );
      res.json(analytics);
    } catch (err) {
      console.error("[analytics-service] overview", err);
      res.status(500).json({ error: "internal" });
    }
  });

  app.get("/v1/daily-stats-aggregate", auth, async (req, res) => {
    const dayStartMs = Number(req.query.dayStartMs);
    const dayEndMs = Number(req.query.dayEndMs);
    const lookbackDays = Number(req.query.lookbackDays);
    if (!Number.isFinite(dayStartMs) || !Number.isFinite(dayEndMs)) {
      res.status(400).json({ error: "dayStartMs and dayEndMs required" });
      return;
    }
    const lookback =
      Number.isFinite(lookbackDays) && lookbackDays >= 1 ? Math.floor(lookbackDays) : 400;
    try {
      const aggregate = await getDailyStatsAggregate(dayStartMs, dayEndMs, lookback);
      res.json(aggregate);
    } catch (err) {
      console.error("[analytics-service] daily-stats-aggregate", err);
      res.status(500).json({ error: "internal" });
    }
  });

  return { app, cfg };
}

export function startAnalyticsService(
  opts: CreateAnalyticsAppOptions = {}
): { server: Server; cfg: AnalyticsServiceConfig } {
  const { app, cfg } = createAnalyticsApp(opts);
  const server = app.listen(cfg.port, cfg.host, () => {
    console.log(
      `[analytics-service] listening on ${cfg.host}:${cfg.port} eventLogDir=${cfg.eventLogDir}`
    );
  });
  return { server, cfg };
}
