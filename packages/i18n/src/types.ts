export const SUPPORTED_LOCALES = ["en", "tr", "pt-BR"] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = "en";

/** Cookie + localStorage key for Locale Preference. */
export const LOCALE_STORAGE_KEY = "nspace_locale";

export function isSupportedLocale(value: string): value is SupportedLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/** Native endonym for the language chooser. */
export const LOCALE_DISPLAY_NAME: Record<SupportedLocale, string> = {
  en: "English",
  tr: "Türkçe",
  "pt-BR": "Português (Brasil)",
};

/**
 * ISO alpha-2 flag code used as a visual cue for each Supported Locale
 * (language, not nationality — English uses GB).
 */
export const LOCALE_FLAG_CODE: Record<SupportedLocale, string> = {
  en: "GB",
  tr: "TR",
  "pt-BR": "BR",
};
