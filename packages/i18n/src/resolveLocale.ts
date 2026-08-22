import {
  DEFAULT_LOCALE,
  isSupportedLocale,
  type SupportedLocale,
  SUPPORTED_LOCALES,
} from "./types.js";

/**
 * Map a BCP 47 tag (or prefix) onto a Supported Locale.
 * `pt` / `pt-*` → `pt-BR` until a separate `pt-PT` catalog exists.
 */
export function matchSupportedLocale(tag: string): SupportedLocale | null {
  const raw = tag.trim().replace(/_/g, "-");
  if (!raw) return null;
  if (isSupportedLocale(raw)) return raw;
  const lower = raw.toLowerCase();
  if (lower === "en" || lower.startsWith("en-")) return "en";
  if (lower === "tr" || lower.startsWith("tr-")) return "tr";
  if (lower === "pt" || lower.startsWith("pt-")) return "pt-BR";
  return null;
}

/**
 * Explicit preference → browser/Accept-Language list → en.
 */
export function resolveLocale(options: {
  preference?: string | null;
  /** Ordered language tags (navigator.languages or Accept-Language). */
  hints?: readonly string[] | null;
}): SupportedLocale {
  const pref = options.preference?.trim();
  if (pref) {
    const matched = matchSupportedLocale(pref);
    if (matched) return matched;
  }
  for (const hint of options.hints ?? []) {
    const matched = matchSupportedLocale(hint);
    if (matched) return matched;
  }
  return DEFAULT_LOCALE;
}

/** Parse an Accept-Language header into ordered tags (q-weight aware, best effort). */
export function parseAcceptLanguage(header: string | undefined | null): string[] {
  if (!header?.trim()) return [];
  return header
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      let q = 1;
      for (const p of params) {
        const m = /^\s*q\s*=\s*([0-9.]+)\s*$/i.exec(p);
        if (m?.[1]) q = Number(m[1]);
      }
      return { tag: (tag ?? "").trim(), q };
    })
    .filter((x) => x.tag.length > 0 && !Number.isNaN(x.q))
    .sort((a, b) => b.q - a.q)
    .map((x) => x.tag);
}

export function assertSupportedLocalesComplete(): void {
  for (const loc of SUPPORTED_LOCALES) {
    if (!isSupportedLocale(loc)) {
      throw new Error(`Invalid supported locale: ${loc}`);
    }
  }
}
