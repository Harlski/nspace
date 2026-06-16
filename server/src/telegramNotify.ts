function telegramEnvTrim(key: string): string {
  return String(process.env[key] ?? "").trim();
}

const TELEGRAM_BOT_TOKEN = telegramEnvTrim("TELEGRAM_BOT_TOKEN");
const TELEGRAM_CHAT_ID = telegramEnvTrim("TELEGRAM_CHAT_ID");

/** Optional Telegram ping (same env as feedback / connect notices). */
export async function sendTelegramPlainText(
  text: string,
  logTag: string
): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  try {
    const chatIdPayload =
      /^-?\d+$/.test(TELEGRAM_CHAT_ID) ? Number(TELEGRAM_CHAT_ID) : TELEGRAM_CHAT_ID;
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
