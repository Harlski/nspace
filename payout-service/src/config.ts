import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __configDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__configDir, "../../.env") });
dotenv.config({ path: path.join(__configDir, "../.env") });

export const LUNA_PER_NIM = 100_000n;

export type AppConfig = {
  host: string;
  port: number;
  apiSecret: string;
  dataDir: string;
  nimNetwork: string;
  defaultTxMessage: string;
  processIntervalMs: number;
  balanceCacheMs: number;
  maxBackoffMs: number;
  deadLetterAfterAttempts: number;
};

function req(name: string, v: string | undefined): string {
  const t = String(v ?? "").trim();
  if (!t) throw new Error(`Missing required environment variable: ${name}`);
  return t;
}

export function loadConfig(): AppConfig {
  const port = Number(process.env.PORT ?? "3091");
  if (!Number.isFinite(port) || port < 1) throw new Error("Invalid PORT");

  const dataDir = process.env.NIM_PAYOUT_DATA_DIR
    ? path.resolve(process.env.NIM_PAYOUT_DATA_DIR)
    : path.join(__configDir, "..", "data");

  return {
    host: String(process.env.HOST ?? "127.0.0.1").trim() || "127.0.0.1",
    port,
    apiSecret: req(
      "PAYOUT_SERVICE_API_SECRET",
      process.env.PAYOUT_SERVICE_API_SECRET
    ),
    dataDir,
    nimNetwork: String(process.env.NIM_NETWORK ?? "testalbatross").toLowerCase(),
    defaultTxMessage: String(
      process.env.NIM_PAYOUT_TX_MESSAGE ?? "You mined NIM on Nimiq.Space!"
    ).trim(),
    processIntervalMs: Math.max(
      500,
      Number(process.env.NIM_PAYOUT_PROCESS_INTERVAL_MS ?? 2000)
    ),
    balanceCacheMs: Math.max(
      0,
      Number(process.env.NIM_BALANCE_CACHE_MS ?? 20_000)
    ),
    maxBackoffMs: Math.max(
      1000,
      Number(process.env.NIM_PAYOUT_MAX_BACKOFF_MS ?? 3_600_000)
    ),
    deadLetterAfterAttempts: Math.max(
      1,
      Number(process.env.NIM_PAYOUT_DEAD_LETTER_ATTEMPTS ?? 80)
    ),
  };
}
