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

function escapeTelegramHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

type TelegramPostResult = "ok" | "missing" | "rejected" | "failed";

/**
 * Optional Telegram ping (same env as feedback / the hourly activity digest).
 *
 * `chatIdOverride` lets callers (e.g. the daily stats report) target a different chat than the
 * default `TELEGRAM_CHAT_ID`; when omitted the default chat is used.
 */
export async function sendTelegramPlainText(
  text: string,
  logTag: string,
  chatIdOverride?: string,
  parseMode?: "HTML"
): Promise<boolean> {
  const result = await postTelegram(text, logTag, chatIdOverride, parseMode);
  return result === "ok";
}

/**
 * Send a monospace table. Telegram HTML `<pre>` keeps column alignment; a rejected parse
 * falls back to the same text without markup.
 */
export async function sendTelegramPreformatted(
  text: string,
  logTag: string,
  chatIdOverride?: string
): Promise<boolean> {
  const html = `<pre>${escapeTelegramHtml(text)}</pre>`;
  const result = await postTelegram(html, logTag, chatIdOverride, "HTML");
  if (result === "ok") return true;
  if (result !== "rejected") return false;
  return (await postTelegram(text, logTag, chatIdOverride)) === "ok";
}

async function postTelegram(
  text: string,
  logTag: string,
  chatIdOverride?: string,
  parseMode?: "HTML"
): Promise<TelegramPostResult> {
  const token = telegramBotToken();
  const chatId = (chatIdOverride ?? "").trim() || telegramDefaultChatId();
  if (!token || !chatId) {
    console.warn(
      `[${logTag}] Telegram env missing:`,
      JSON.stringify({ hasToken: Boolean(token), hasChatId: Boolean(chatId) })
    );
    return "missing";
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
        ...(parseMode ? { parse_mode: parseMode } : {}),
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
      return resp.status === 400 ? "rejected" : "failed";
    }
    return "ok";
  } catch (err) {
    console.error(`[${logTag}] Telegram notify failed:`, err);
    return "failed";
  }
}
