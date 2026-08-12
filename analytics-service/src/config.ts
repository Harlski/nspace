import path from "node:path";
import { fileURLToPath } from "node:url";

const __configDir = path.dirname(fileURLToPath(import.meta.url));

export type AnalyticsServiceConfig = {
  host: string;
  port: number;
  apiSecret: string;
  eventLogDir: string;
};

function req(name: string, v: string | undefined): string {
  const t = String(v ?? "").trim();
  if (!t) throw new Error(`Missing required environment variable: ${name}`);
  return t;
}

export function loadConfig(): AnalyticsServiceConfig {
  const port = Number(process.env.PORT ?? "3092");
  if (!Number.isFinite(port) || port < 1) throw new Error("Invalid PORT");

  const eventLogDir = process.env.EVENT_LOG_DIR
    ? path.resolve(process.env.EVENT_LOG_DIR)
    : path.join(__configDir, "../../server/data/events");

  return {
    host: String(process.env.HOST ?? "127.0.0.1").trim() || "127.0.0.1",
    port,
    apiSecret: req(
      "ANALYTICS_SERVICE_API_SECRET",
      process.env.ANALYTICS_SERVICE_API_SECRET
    ),
    eventLogDir,
  };
}
