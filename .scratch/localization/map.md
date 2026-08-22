# Map: User-facing localization

Label: `wayfinder:map`

## Destination

**Reached (decisions + AFK tracer implement).** Locked decision set is in [spec.md](spec.md). AFK override (1B/2A/3A) also landed production infra: `@nspace/i18n`, Player Menu Language, achievement catalog keys + panel `t()`, partial chrome/SSR. Remaining call-site migration (esp. `hud.ts`) continues outside this map as ordinary implement work.

A **locked decision set** ready to hand off to `/to-spec` (then `/to-tickets` / implement) for shipping **user-facing** localization: game client UI, achievements, feedback, and all **non-admin** HTML surfaces — with **`en` as catalog source of truth + per-string fallback**, first alternate locales **`tr`** and **`pt-BR`**, and **`/admin/*` English-only**. Default wayfinder produces decisions; AFK override allowed implementation of the tracer and shared package.

## Notes

- Domain: Nimiq Space UI and player-visible copy. Glossary: [CONTEXT.md](../../CONTEXT.md). Prior non-normative sketch: [docs/localization.md](../../docs/localization.md), [docs/brainstorm/localization-implementation-plan.md](../../docs/brainstorm/localization-implementation-plan.md).
- Consult: [docs/THE-LARGER-SYSTEM.md](../../docs/THE-LARGER-SYSTEM.md), [docs/ui-styling.md](../../docs/ui-styling.md), [docs/process.md](../../docs/process.md).
- **Grill posture:** user asked the agent to use its recommendations for all grilling; decisions are **agent-locked** unless a later human overrides.
- **AFK execution override:** user chose implement as far as possible (**1B**) + draft `tr` / `pt-BR` translations (**2A**) + legal bodies English, chrome only (**3A**); map may include implementation beyond default wayfinder.
- **Standing product locks (from charting):**
  - Scope in: game UI, achievements, in-game feedback, main menu / site chrome that players see, non-admin server HTML (`/advertise`, `/payouts`, terms/privacy shells, guides, etc.).
  - Scope out of product for this effort: `/admin/*` and admin-only overlays.
  - Locales v1: `en`, `tr`, `pt-BR` (`pt` / `pt-*` browser tags map to `pt-BR` until `pt-PT` exists).
  - Resolution: explicit Locale Preference → browser best match among supported → `en`.
  - Language control v1: **Player Menu** only (guest + full); not Action Wheel / HUD widget; main-menu and site-footer controls deferred.
  - Persistence v1: `localStorage` + cookie (same value) so SSR pages can negotiate without JWT; profile sync later optional.
- **Standing architecture / process recommendations (agent-locked):**
  - ICU MessageFormat behind a thin `t(key, values)` API; avoid DIY template-literal i18n.
  - Shared message catalogs in **`packages/i18n`** consumed by client and server so game and non-admin HTML do not drift; `/analytics` uses `analytics.*`.
  - On language change: update preference + `document.documentElement.lang`, re-render client chrome immediately; SSR uses cookie on next request.
  - Missing `tr` / `pt-BR` value → fall back to `en` string (never show raw keys).
  - New features: English keys land in the same PR as the UI; translations may lag with English fallback; document the rule in `THE-LARGER-SYSTEM` + `process.md` checklist.
- Skills for ticket sessions: `/grilling`, `/domain-modeling`; research tickets use `/research`.

## Decisions so far

- [Choose ICU-capable i18n stack for Vite + Express](issues/02-choose-icu-stack.md) — **`@formatjs/intl`** (not `i18next` + `i18next-icu`) behind thin shared `t(key, values)`; detail [research/02-choose-icu-stack.md](research/02-choose-icu-stack.md).
- [Inventory user-facing string surfaces](issues/01-inventory-string-surfaces.md) — v1 covers player UI/achievements/feedback/non-admin HTML/terms chrome; `/admin/*`, authored, and third-party out — [research/01-inventory-string-surfaces.md](research/01-inventory-string-surfaces.md).
- [Shared Message Catalog ownership](issues/03-shared-catalog-ownership.md) — **`packages/i18n`**; namespaces by surface; `/analytics` → `analytics.*`.
- [Achievement and server-owned display strings](issues/04-achievement-string-authority.md) — stable ids → catalog keys; client `t()` for display.
- [Locale Preference apply semantics](issues/05-locale-apply-semantics.md) — `localStorage` + cookie; immediate re-render; cookie for SSR.
- [Terms/privacy and authored-vs-product copy](issues/06-authored-vs-product-copy.md) — legal bodies English; marquee authored; product chrome in catalogs (3A).
- [Ongoing localization rule for new features](issues/07-ongoing-feature-rule.md) — principle in THE-LARGER-SYSTEM + process checklist.
- [Player Menu language chooser tracer](issues/08-language-chooser-prototype.md) — skip throwaway prototype; production Player Menu Language row is the tracer.

## Not yet specified

- Glossary ownership for branded terms (who reviews native `tr` / `pt-BR` beyond agent drafts).
- How aggressively to migrate existing large modules (`hud.ts`, achievement registry) vs tracer-bullet first surface in the build plan (Player Menu Language row is the agreed tracer; sequencing of remaining surfaces is execution detail).
- Optional later: main-menu / site-footer language control; account-synced Locale Preference; `pt-PT`; automated string extraction; pseudo-locale CI.

## Out of scope

- Localizing **`/admin/*`** pages and admin-only tooling UI.
- Translating **user-authored** content (chat, usernames, signboards, voxel labels, campaign copy players enter).
- Translating **third-party** chrome (Nimiq Hub, Nimiq Pay SDK UI).
- Translating **legal body** HTML in v1 (English until counsel-reviewed; chrome only).
- Translating **admin-authored marquee** news (authored language as-is).
- RTL layout work (no RTL locale in v1).
- Throwaway language-chooser prototype (production Player Menu row is the tracer).
