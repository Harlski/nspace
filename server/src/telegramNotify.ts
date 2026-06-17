function telegramEnvTrim(key: string): string {
  return String(process.env[key] ?? "").trim();
}

const TELEGRAM_BOT_TOKEN = telegramEnvTrim("TELEGRAM_BOT_TOKEN");
const TELEGRAM_CHAT_ID = telegramEnvTrim("TELEGRAM_CHAT_ID");

/** True when a bot token and a default chat id are both configured. */
export function isTelegramConfigured(): boolean {
  return Boolean(TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID);
}

/**
 * Optional Telegram ping (same env as feedback / connect notices).
 *
 * `chatIdOverride` lets callers (e.g. the daily stats report) target a different chat than the
 * default `TELEGRAM_CHAT_ID`; when omitted the default chat is used.
 */
export async function sendTelegramPlainText(
  text: string,
  logTag: string,
  chatIdOverride?: string
): Promise<void> {
  const chatId = (chatIdOverride ?? "").trim() || TELEGRAM_CHAT_ID;
  if (!TELEGRAM_BOT_TOKEN || !chatId) return;
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  try {
    const chatIdPayload = /^-?\d+$/.test(chatId) ? Number(chatId) : chatId;
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatIdPayload,
        text,
        disable_web_page_preview: true,
      }),
    });
  } catch (err) {
    console.error(`[${logTag}] Telegram notify failed:`, err);
  }
}
