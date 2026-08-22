---
Type: grilling
Status: resolved
Blocked by: 02
---

# Shared Message Catalog ownership

## Question

Where do Message Catalogs live in the monorepo, and how do client and server both consume them without drift?

Agent recommendation to lock unless overridden: add a small workspace package (e.g. `packages/i18n` or `shared/locales`) holding JSON (or generated) catalogs per Supported Locale, plus the shared `t` / locale-resolution helpers; `client` and `server` depend on it. Namespaces by surface (`hud.*`, `achievements.*`, `advertise.*`, …). English is the only required complete catalog.

Also decide: do analytics allowlisted `/analytics` pages share `common.*` keys or a dedicated namespace (they are non-admin but operator-ish)?

## Answer

**`packages/i18n`** holds Message Catalogs (per Supported Locale) plus shared `t` / locale-resolution helpers; `client` and `server` depend on it. Namespaces by surface (`hud.*`, `achievements.*`, `advertise.*`, …). English is the only required complete catalog. Allowlisted `/analytics` pages use a dedicated **`analytics.*`** namespace (not shared `common.*` keys for operator-ish chrome).
