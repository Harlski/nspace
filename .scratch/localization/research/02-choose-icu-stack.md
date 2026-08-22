# Research: ICU MessageFormat stack for vanilla TS (Vite + Express)

**Ticket:** [issues/02-choose-icu-stack.md](../issues/02-choose-icu-stack.md)  
**Date:** 2026-08-22  
**Scope:** Shared `t(key, values)` API for client (vanilla TypeScript / Vite, no React) and server (Express), JSON catalogs, locales `en` / `tr` / `pt-BR`, English source-of-truth + fallback.

## Recommendation

**Standardize on `@formatjs/intl` (which depends on `intl-messageformat`) behind a thin shared wrapper that exposes `t(key, values)`.**

Do **not** default to `i18next` + `i18next-icu` for this repo. ICU formatting quality is the same either way (i18next-icu is a bridge onto FormatJS). The FormatJS imperative API matches flat JSON catalogs, a vanilla DOM client, and a small shared workspace package better, with less framework surface and a smaller install footprint.

---

## What “ICU MessageFormat” means here

Unicode ICU MessageFormat is the industry pattern for single-string messages with placeholders, **plural**, and **select** (and related) arguments so translators keep a full sentence with nested variants. Official guidance:

- Use `plural` for language plural rules; use `select` for fixed keyword choice (e.g. gender/category). Prefer complex arguments as the **outermost** structure with full sentences in sub-messages. ([ICU Formatting Messages](https://unicode-org.github.io/icu/userguide/format_parse/messages/))
- Prefer real apostrophe U+2019 in human text; use ASCII `'` only for MessageFormat quoting. ([same](https://unicode-org.github.io/icu/userguide/format_parse/messages/))

FormatJS documents the same syntax for JS (`plural`, `select`, `selectordinal`, number/date args, `#` in plural arms). ([FormatJS ICU syntax](https://formatjs.github.io/docs/core-concepts/icu-syntax/))

---

## Candidates compared

### A. `i18next` + `i18next-icu`

| Aspect | Finding | Source |
|--------|---------|--------|
| ICU completeness | Plugin replaces i18next’s own message format with ICU via **`intl-messageformat`**. Supports ICU plurals/selects as that library does. | [i18next-icu README](https://github.com/i18next/i18next-icu/blob/master/README.md) |
| Caveat | With the plugin, **i18next interpolation / plurals / context do not apply**; only ICU/`intl-messageformat` behavior. Syntax is `{name}`, not `{{name}}`. | [same README “Advice” / “hints”](https://github.com/i18next/i18next-icu/blob/master/README.md) |
| Runtime locale switch | First-class: `i18next.changeLanguage(lng)`. | [i18next API](https://www.i18next.com/overview/api) |
| English fallback | First-class: `fallbackLng: 'en'` (string, array, or map). | [i18next Fallback](https://www.i18next.com/principles/fallback) |
| Shared catalogs | Init with in-memory `resources: { en: { translation: { ... } }, ... }` or backends. Nested **language → namespace → keys** shape. | [Getting started](https://www.i18next.com/overview/getting-started), [configuration](https://www.i18next.com/overview/configuration-options) |
| JSON fit | Fine if catalogs are adapted into i18next’s resource tree (or flat keys with separators). Extra concepts: namespaces, backends, detectors. | same |
| Bundle / install | `i18next` unpacked ~523 KB; `i18next-icu` ~761 KB (ships browser builds); still needs peer `intl-messageformat`. | npm `dist.unpackedSize` (queried 2026-08-22): i18next@26.4.0, i18next-icu@2.4.4 |
| Maintenance / TS | Mature ecosystem, but ICU mode fights i18next’s defaults: TS interpolation extractor misreads ICU nested braces unless `parseInterpolation: false` (i18next ≥ 26.2.0). | [i18next-icu README TypeScript](https://github.com/i18next/i18next-icu/blob/master/README.md) |
| Vanilla fit | Works without React. Pays for a large resource/plugin framework primarily for `t` + `changeLanguage` + `fallbackLng`, while message formatting is FormatJS underneath. | synthesis from above |

### B. `@formatjs/intl` / `intl-messageformat`

| Aspect | Finding | Source |
|--------|---------|--------|
| ICU completeness | `intl-messageformat`: ICU Message syntax; **plural**, **select**, **selectordinal**; number/date via `Intl.*`. | [FormatJS intl-messageformat](https://formatjs.github.io/docs/intl-messageformat/) |
| Catalog + `t`-like API | `@formatjs/intl` is the **framework-agnostic** core (also used by react-intl). `createIntl({ locale, messages })` → `formatMessage(descriptor, values)`. `messages` is `Record<string, string>` (or precompiled AST). | [FormatJS Intl](https://formatjs.github.io/docs/intl/) |
| Runtime locale switch | Documented lifecycle: intl instance is tied to **locale + messages**; **recreate** on locale change; reuse `createIntlCache()` across locales. | [same](https://formatjs.github.io/docs/intl/) |
| Missing-key / English fallback | Built-in algorithm: translated message by `id` → `defaultMessage` → raw sources → literal `id`. There is **no** built-in second locale catalog; for “missing `tr`/`pt-BR` → `en` catalog string”, resolve the string in a thin `t()` (lookup current then `en`), then format. Optionally pass `defaultMessage` from `en`. | [formatMessage fallbacks](https://formatjs.github.io/docs/intl/) |
| Shared catalogs | Flat JSON maps per locale (`en.json`, `tr.json`, `pt-BR.json`) load into `messages` identically on client and server. Fits a shared workspace package cleanly. | [IntlConfig.messages](https://formatjs.github.io/docs/intl/) |
| JSON fit | Excellent: key → ICU pattern string. No forced namespace tree. | same |
| Bundle / install | `@formatjs/intl` unpacked ~90 KB; depends on `intl-messageformat` (~113 KB) + parser (~248 KB) + small memoize. Smaller and more ICU-focused than i18next + plugin. | npm `dist.unpackedSize` (queried 2026-08-22): @formatjs/intl@4.1.19, intl-messageformat@11.2.14, @formatjs/icu-messageformat-parser |
| Maintenance | FormatJS owns the ICU implementation; one vendor for parser + formatter + imperative API. No React required for `@formatjs/intl`. | [FormatJS Intl](https://formatjs.github.io/docs/intl/), [npm @formatjs/intl](https://www.npmjs.com/package/@formatjs/intl) |
| Vanilla fit | Explicit imperative API (`createIntl` / `formatMessage` / `formatNumber` / …). Natural for DOM + Express. | [FormatJS Intl](https://formatjs.github.io/docs/intl/) |

### C. `intl-messageformat` alone (no `@formatjs/intl`)

Viable for the absolute minimum (“parse one string + `format(values)`”), but **you** own catalog lookup, locale switching, caching of formatters, and date/number helpers. `@formatjs/intl` already wraps that for message maps and memoized `Intl.*` via `createIntlCache`. Prefer the higher-level package unless a future size audit proves otherwise. ([intl-messageformat usage](https://formatjs.github.io/docs/intl-messageformat/))

---

## Judgment against repo constraints

| Criterion | Winner | Why |
|-----------|--------|-----|
| ICU plurals / selects | **Tie** (FormatJS engine) | i18next-icu **is** FormatJS under the hood. |
| Runtime locale switch | Slight edge **i18next** for built-in API; **FormatJS adequate** | Recreate `createIntl` on preference change; matches map (“re-render chrome immediately”). |
| Shared client/server catalogs | **`@formatjs/intl`** | Flat JSON `Record<string, string>` matches planned shared package; no lng/ns ceremony. |
| Bundle cost | **`@formatjs/intl`** | Smaller unpacked footprint than i18next + i18next-icu; no unused i18next formatting features. |
| Maintenance | **`@formatjs/intl`** | One ICU stack; avoid plugin that disables host-library formatting + TS extractor footguns. |
| JSON catalogs + `en` fallback | **Either**, FormatJS slightly cleaner for flat files | Implement `t` as: resolve string from locale map → else `en` → `formatMessage` / never show raw keys. |

---

## Default for this repo

**Package default:** `@formatjs/intl` (pulls `intl-messageformat`).

**API shape (wrapper, not app code here):**

- Shared helper e.g. `t(key, values?)` / `setLocale(locale)` / access to `formatNumber` etc. when needed.
- Catalogs: per-locale JSON objects of ICU pattern strings; `en` is source of truth.
- On locale change: rebuild intl with that locale’s `messages` (and keep `en` map for missing-key fallback); update `document.documentElement.lang` on the client as already planned in the map.
- Do not invent DIY template-literal i18n for product strings.

**Reject as default:** `i18next` + `i18next-icu` — useful if the team already needs i18next backends/namespaces/detectors, but for nspace’s vanilla client + Express shared catalogs it adds weight and friction while delivering the same ICU formatter.

---

## Primary sources

1. [ICU User Guide — Formatting Messages](https://unicode-org.github.io/icu/userguide/format_parse/messages/)  
2. [FormatJS — ICU syntax](https://formatjs.github.io/docs/core-concepts/icu-syntax/)  
3. [FormatJS — intl-messageformat](https://formatjs.github.io/docs/intl-messageformat/)  
4. [FormatJS — @formatjs/intl (`createIntl`, `formatMessage`)](https://formatjs.github.io/docs/intl/)  
5. [i18next-icu README](https://github.com/i18next/i18next-icu/blob/master/README.md)  
6. [i18next API (`changeLanguage`, `t`)](https://www.i18next.com/overview/api)  
7. [i18next Fallback (`fallbackLng`)](https://www.i18next.com/principles/fallback)  
8. npm package metadata for unpacked sizes (i18next@26.4.0, i18next-icu@2.4.4, @formatjs/intl@4.1.19, intl-messageformat@11.2.14) — queried 2026-08-22.
