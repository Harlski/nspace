import type { Request } from "express";
import {
  createTranslator,
  LOCALE_STORAGE_KEY,
  parseAcceptLanguage,
  resolveLocale,
  type SupportedLocale,
  type Translator,
} from "@nspace/i18n";

function readCookieValue(
  cookieHeader: string | undefined,
  name: string
): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim();
    if (key !== name) continue;
    const raw = part.slice(idx + 1).trim();
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
  return null;
}

/** Resolve Supported Locale from optional `?lang=`, cookie, Accept-Language, else en. */
export function requestLocale(req: Request): SupportedLocale {
  const langQuery =
    typeof req.query.lang === "string" ? req.query.lang.trim() : "";
  const preference =
    langQuery ||
    readCookieValue(req.headers.cookie, LOCALE_STORAGE_KEY) ||
    null;
  const accept =
    typeof req.headers["accept-language"] === "string"
      ? req.headers["accept-language"]
      : undefined;
  return resolveLocale({
    preference,
    hints: parseAcceptLanguage(accept),
  });
}

/** Request-scoped translator for the resolved locale. */
export function requestTranslator(req: Request): Translator {
  return createTranslator(requestLocale(req));
}
