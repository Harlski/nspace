import "dotenv/config";

export type AppConfig = {
  port: number;
  apiSecret: string;
  sqlitePath: string;
  recipientAddress: string;
  nimNetwork: string;
  nimClientLogLevel: string;
  intentTtlMs: number;
  minConfirmations: number;
};

function req(name: string, v: string | undefined): string {
  const t = String(v ?? "").trim();
  if (!t) throw new Error(`Missing required environment variable: ${name}`);
  return t;
}

export function loadConfig(): AppConfig {
  const port = Number(process.env.PORT ?? "3090");
  if (!Number.isFinite(port) || port < 1) throw new Error("Invalid PORT");

  return {
    port,
    apiSecret: req("PAYMENT_INTENT_API_SECRET", process.env.PAYMENT_INTENT_API_SECRET),
    sqlitePath: String(
      process.env.PAYMENT_INTENT_SQLITE_PATH ?? "./data/payment-intents.sqlite"
    ),
    recipientAddress: req(
      "PAYMENT_INTENT_RECIPIENT_ADDRESS",
      process.env.PAYMENT_INTENT_RECIPIENT_ADDRESS
    ),
    nimNetwork: String(process.env.NIM_NETWORK ?? "testalbatross").toLowerCase(),
    nimClientLogLevel: String(process.env.NIM_CLIENT_LOG_LEVEL ?? "warn"),
    intentTtlMs: Math.max(
      60_000,
      Number(process.env.PAYMENT_INTENT_TTL_MS ?? 1_800_000)
    ),
    minConfirmations: Math.max(
      1,
      Math.floor(Number(process.env.PAYMENT_INTENT_MIN_CONFIRMATIONS ?? "1"))
    ),
  };
}
