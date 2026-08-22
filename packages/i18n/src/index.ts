import {
  createTranslator,
  getSharedTranslator,
  setSharedTranslator,
  t,
  type MessageValues,
  type Translator,
} from "./createTranslator.js";
import {
  parseAcceptLanguage,
  resolveLocale,
  matchSupportedLocale,
} from "./resolveLocale.js";
import {
  DEFAULT_LOCALE,
  isSupportedLocale,
  LOCALE_DISPLAY_NAME,
  LOCALE_FLAG_CODE,
  LOCALE_STORAGE_KEY,
  SUPPORTED_LOCALES,
  type SupportedLocale,
} from "./types.js";

export {
  createTranslator,
  getSharedTranslator,
  setSharedTranslator,
  t,
  parseAcceptLanguage,
  resolveLocale,
  matchSupportedLocale,
  DEFAULT_LOCALE,
  isSupportedLocale,
  LOCALE_DISPLAY_NAME,
  LOCALE_FLAG_CODE,
  LOCALE_STORAGE_KEY,
  SUPPORTED_LOCALES,
};

export type { MessageValues, SupportedLocale, Translator };

/** Achievement Message Catalog key helpers. */
export function achievementTitleKey(id: string): string {
  return `achievements.${id}.title`;
}

export function achievementDescriptionKey(id: string): string {
  return `achievements.${id}.description`;
}
