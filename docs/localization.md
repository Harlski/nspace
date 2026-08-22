# Localization (i18n)

**Status:** Shared i18n infra is in place. Player Menu **Language** works end-to-end. Broader UI migration to Message Catalog keys is ongoing; many surfaces still hard-code English.

## What is implemented

| Piece | Detail |
|-------|--------|
| Package | Workspace [`packages/i18n`](../packages/i18n/) (`@nspace/i18n`), consumed by client (and available to server) |
| Stack | [`@formatjs/intl`](https://formatjs.io/) behind thin `t(key, values)` / `createTranslator` |
| Supported Locales | `en` (source of truth), `tr`, `pt-BR` |
| Locale Preference | `localStorage` + cookie key `nspace_locale`; resolve order: preference → browser / `Accept-Language` hints → `en` |
| Player control | Player Menu **Language** row (guest + full); updates preference, `document.documentElement.lang`, and subscribed chrome immediately |
| Fallback | Missing `tr` / `pt-BR` strings render the English catalog value (never raw keys when `en` has the string) |
| Catalogs | JSON under `packages/i18n/src/locales/` (`en.json`, `tr.json`, `pt-BR.json`) |
| Client boot | [`client/src/i18n/bootstrap.ts`](../client/src/i18n/bootstrap.ts) via `bootstrapClientI18n()` early in [`client/src/main.ts`](../client/src/main.ts) |

**Tracer surface today:** Player Menu labels / Language chooser ([`client/src/ui/playerMenu.ts`](../client/src/ui/playerMenu.ts)). Catalogs already hold keys for other product chrome (achievements, feedback, legal ack chrome, nav titles, …) ahead of full call-site migration.

## Scope rules (v1)

- **`/admin/*`** and admin-only overlays: English only; no catalog requirement.
- **Legal page bodies:** English; legal / ack **chrome** may use catalog keys.
- **User-authored** content (chat, usernames, signboards, voxels, player campaign fields) and **third-party** chrome (Nimiq Hub, Pay SDK): not localized by product catalogs.
- **Draft translations:** `tr` / `pt-BR` strings are agent drafts pending native review.

## Ongoing feature rule

New player-visible **product** strings go through Message Catalog keys in the **same change** as the UI. English (`en`) is required; `tr` / `pt-BR` may lag with English fallback. See [THE-LARGER-SYSTEM.md](THE-LARGER-SYSTEM.md) (Principles) and the checklist note in [process.md](process.md).

## Spec and planning

- Normative working spec (AFK / implementation decisions): [`.scratch/localization/spec.md`](../.scratch/localization/spec.md)
- Historical brainstorm (non-normative): [brainstorm/localization-implementation-plan.md](brainstorm/localization-implementation-plan.md)

**Related:** [ui-styling.md](ui-styling.md), [process.md](process.md), [features-checklist.md](features-checklist.md).
