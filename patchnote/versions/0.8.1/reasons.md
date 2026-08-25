# Reasons — 0.8.1 (patch-notes version)

**Patch-notes version:** `0.8.1` (frozen via `npm run prepare-merge`).

**Role:** Technical **reasons** attached to **this** patch-notes version — file-level and behavior-level inventory. Public-facing copy at other depths lives only under [public/](public/).

---

## Summary

Added Supported Locales **vi**, **es**, and **fil** with full Message Catalog drafts (~355 keys each).

---

## By area

### Repo / docs

- `docs/localization.md`, `docs/features-checklist.md`, `docs/process.md`, `docs/README.md` — Supported Locales now `en` / `tr` / `pt-BR` / `vi` / `es` / `fil`.

### Client

- _(none — Language chooser already iterates `SUPPORTED_LOCALES`)_

### Server

- _(none — `requestLocale` uses shared `@nspace/i18n` resolver)_

### packages/i18n

- `SUPPORTED_LOCALES` extended with `vi`, `es`, `fil`; display names and flag codes (`VN`, `CR`, `PH`).
- `matchSupportedLocale`: `vi-*` → `vi`, `es-*` → `es`, `fil-*` / `tl` → `fil`.
- New catalogs: `vi.json`, `es.json`, `fil.json` (agent drafts, native review pending).

### payment-intent-service

- _(none in this change set)_

### Deploy / ops

- Vercel / Docker: build `@nspace/i18n` before client/server; copy `packages/i18n` into the game image ([docs/reasons/reason_123497.md](../../../docs/reasons/reason_123497.md)).
