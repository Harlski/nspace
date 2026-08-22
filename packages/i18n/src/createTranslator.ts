import { createIntl, createIntlCache, type IntlShape } from "@formatjs/intl";
import en from "./locales/en.json" with { type: "json" };
import ptBR from "./locales/pt-BR.json" with { type: "json" };
import tr from "./locales/tr.json" with { type: "json" };
import {
  DEFAULT_LOCALE,
  type SupportedLocale,
} from "./types.js";

export type MessageValues = Record<
  string,
  string | number | boolean | Date | null | undefined
>;

type Catalog = Record<string, string>;

const CATALOGS: Record<SupportedLocale, Catalog> = {
  en: en as Catalog,
  tr: tr as Catalog,
  "pt-BR": ptBR as Catalog,
};

const intlCache = createIntlCache();

function mergeMessages(locale: SupportedLocale): Catalog {
  if (locale === "en") return { ...CATALOGS.en };
  const merged: Catalog = { ...CATALOGS.en };
  for (const [key, value] of Object.entries(CATALOGS[locale])) {
    if (typeof value === "string" && value.length > 0) {
      merged[key] = value;
    }
  }
  return merged;
}

function buildIntl(locale: SupportedLocale): IntlShape {
  return createIntl(
    {
      locale,
      defaultLocale: DEFAULT_LOCALE,
      messages: mergeMessages(locale),
      onError(err) {
        // Missing messages should already be filled from en; ignore FORMAT_ERROR noise in prod.
        if (err.code === "MISSING_TRANSLATION") return;
      },
    },
    intlCache,
  );
}

export type Translator = {
  t: (id: string, values?: MessageValues) => string;
  getLocale: () => SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
  subscribe: (listener: () => void) => () => void;
  /** English source string for a key (for tests / admin). */
  en: (id: string) => string | undefined;
};

export function createTranslator(
  initialLocale: SupportedLocale = DEFAULT_LOCALE,
): Translator {
  let locale = initialLocale;
  let intl = buildIntl(locale);
  const listeners = new Set<() => void>();

  function notify(): void {
    for (const listener of listeners) listener();
  }

  function t(id: string, values?: MessageValues): string {
    const defaultMessage = CATALOGS.en[id] ?? id;
    try {
      return intl.formatMessage({ id, defaultMessage }, values as Record<string, string | number | boolean | Date>);
    } catch {
      return defaultMessage;
    }
  }

  return {
    t,
    getLocale: () => locale,
    setLocale(next: SupportedLocale) {
      if (next === locale) return;
      locale = next;
      intl = buildIntl(locale);
      notify();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    en(id) {
      return CATALOGS.en[id];
    },
  };
}

/** Shared process-wide translator for simple call sites (client bootstraps once). */
let shared: Translator | null = null;

export function getSharedTranslator(): Translator {
  if (!shared) shared = createTranslator(DEFAULT_LOCALE);
  return shared;
}

export function setSharedTranslator(translator: Translator): void {
  shared = translator;
}

export function t(id: string, values?: MessageValues): string {
  return getSharedTranslator().t(id, values);
}
