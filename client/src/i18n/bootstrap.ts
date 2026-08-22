import {
  createTranslator,
  getSharedTranslator,
  LOCALE_STORAGE_KEY,
  resolveLocale,
  setSharedTranslator,
  type SupportedLocale,
  type Translator,
} from "@nspace/i18n";

const COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 365;

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const parts = document.cookie.split(";");
  for (const part of parts) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim();
    if (key !== name) continue;
    return decodeURIComponent(part.slice(idx + 1).trim());
  }
  return null;
}

function writeCookie(name: string, value: string): void {
  if (typeof document === "undefined") return;
  const secure =
    typeof location !== "undefined" && location.protocol === "https:"
      ? "; Secure"
      : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${COOKIE_MAX_AGE_SEC}; SameSite=Lax${secure}`;
}

function readStoredPreference(): string | null {
  try {
    const fromLs = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (fromLs) return fromLs;
  } catch {
    /* private mode */
  }
  return readCookie(LOCALE_STORAGE_KEY);
}

function persistPreference(locale: SupportedLocale): void {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    /* ignore */
  }
  writeCookie(LOCALE_STORAGE_KEY, locale);
}

function browserHints(): string[] {
  if (typeof navigator === "undefined") return [];
  if (Array.isArray(navigator.languages) && navigator.languages.length > 0) {
    return [...navigator.languages];
  }
  return navigator.language ? [navigator.language] : [];
}

function applyDocumentLang(locale: SupportedLocale): void {
  if (typeof document === "undefined") return;
  document.documentElement.lang = locale;
}

/**
 * Boot the shared translator from Locale Preference / browser / en.
 * Call once early in client startup.
 */
export function bootstrapClientI18n(): Translator {
  const preference = readStoredPreference();
  const locale = resolveLocale({
    preference,
    hints: browserHints(),
  });
  const translator = createTranslator(locale);
  setSharedTranslator(translator);
  applyDocumentLang(locale);
  persistPreference(locale);
  return translator;
}

/** Apply an explicit Locale Preference and notify subscribers. */
export function setClientLocale(locale: SupportedLocale): void {
  const translator = getSharedTranslator();
  translator.setLocale(locale);
  persistPreference(locale);
  applyDocumentLang(locale);
}

export function getClientLocale(): SupportedLocale {
  return getSharedTranslator().getLocale();
}
