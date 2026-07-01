function telegramEnvTrim(key: string): string {
  let v = String(process.env[key] ?? "").trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1).trim();
  }
  return v;
}

function telegramBotToken(): string {
  return telegramEnvTrim("TELEGRAM_BOT_TOKEN");
}

function telegramDefaultChatId(): string {
  return telegramEnvTrim("TELEGRAM_CHAT_ID");
}

/** True when a bot token and a default chat id are both configured. */
export function isTelegramConfigured(): boolean {
  return Boolean(telegramBotToken() && telegramDefaultChatId());
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
): Promise<boolean> {
  const token = telegramBotToken();
  const chatId = (chatIdOverride ?? "").trim() || telegramDefaultChatId();
  if (!token || !chatId) {
    console.warn(
      `[${logTag}] Telegram env missing:`,
      JSON.stringify({ hasToken: Boolean(token), hasChatId: Boolean(chatId) })
    );
    return false;
  }
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  try {
    const chatIdPayload = /^-?\d+$/.test(chatId) ? Number(chatId) : chatId;
    const resp = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatIdPayload,
        text,
        disable_web_page_preview: true,
      }),
    });
    const bodyText = await resp.text();
    if (!resp.ok) {
      console.error(
        `[${logTag}] Telegram response error:`,
        JSON.stringify({
          ok: resp.ok,
          status: resp.status,
          body: bodyText.slice(0, 400),
        })
      );
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[${logTag}] Telegram notify failed:`, err);
    return false;
  }
}
