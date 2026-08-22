# Reasons — 0.8.0 (patch-notes version)

**Patch-notes version:** `0.8.0` (frozen via `npm run prepare-merge`).

**Role:** Technical **reasons** attached to **this** patch-notes version — file-level and behavior-level inventory. Public-facing copy at other depths lives only under [public/](public/).

---

## Summary

Ship user-facing localization infra (`@nspace/i18n`, Player Menu Language modal with flags, catalogs `en`/`tr`/`pt-BR`) plus first call-site migrations (achievements, mining/earn chrome, `/payouts` SSR); broader HUD migration ongoing.

---

## By area

### Repo / docs

- Localization status rewritten in [docs/localization.md](../../../docs/localization.md); principle + reason `746291` in [docs/THE-LARGER-SYSTEM.md](../../../docs/THE-LARGER-SYSTEM.md); i18n checklist in [docs/process.md](../../../docs/process.md); features checklist entry.

### Client

- **i18n infra + Player Menu Language** — workspace `@nspace/i18n` (`packages/i18n`, `@formatjs/intl`); catalogs `en` / `tr` / `pt-BR`; client boot in `client/src/i18n/bootstrap.ts` (Locale Preference `localStorage` + cookie `nspace_locale`, `document.documentElement.lang`); Player Menu Language row shows a locale flag and opens a popup modal (`client/src/ui/languageModal.ts`) with English recovery title; mining claim bar, daily-earn cinematic/pulse/profile copy, and Free Play reward flashes use Message Catalog keys. Broader UI call-site migration ongoing. English fallback for missing alternate-locale strings; `/admin/*` out of scope; legal bodies English; draft `tr` / `pt-BR` pending native review.

### Server

- `@nspace/i18n` workspace dependency; `server/src/i18n/requestLocale.ts` resolves Locale Preference (optional `?lang=` → cookie `nspace_locale` → `Accept-Language` → `en`) and builds a request translator; `/payouts` uses it for `html lang` and title.

### payment-intent-service

- _(none in this change set)_

### Deploy / ops

- _(none in this change set)_
