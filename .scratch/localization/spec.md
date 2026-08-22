# Spec: User-facing localization (v1)

Status: ready-for-agent

## Problem

Nimiq Space ships player-visible copy almost entirely as hard-coded English across the game client, achievements, feedback, and non-admin HTML. There is no shared Locale Preference, no Message Catalog, and no Supported Locale set beyond implicit English — so alternate locales cannot ship without string drift between client and server, and new features keep reintroducing English-only chrome.

## Solution

Introduce a shared ICU MessageFormat stack (`@formatjs/intl` behind thin `t(key, values)`) and Message Catalogs in workspace package **`packages/i18n`**, consumed by both client and server. Supported Locales for v1 are **`en`** (complete source of truth), **`tr`**, and **`pt-BR`**. Players set Locale Preference from the Player Menu Language row; preference persists in `localStorage` + cookie; missing alternate-locale strings fall back to English. Agent drafts `tr` / `pt-BR` pending native review. Implement as far as possible in one effort (AFK 1B): production Language row is the tracer; migrate remaining in-scope surfaces without a throwaway prototype.

## User stories (abbreviated)

- As a player (guest or full), I can choose Language in the Player Menu among Supported Locales named in their own language, and see localized product chrome update immediately.
- As a player with Locale Preference `tr` or `pt-BR`, I see translated UI where catalogs exist, and English where they do not — never raw keys.
- As a visitor to non-admin SSR pages, I get the same Locale Preference via cookie (else browser best match, else `en`).
- As a developer shipping a feature, I add English Message Catalog keys in the same change as the UI; alternate locales may lag with fallback.
- As an operator on `/analytics`, I see operator-ish chrome under `analytics.*` keys, not `/admin/*` English-only tooling.

## Implementation decisions

| Topic | Decision |
|-------|----------|
| Stack | `@formatjs/intl` + thin shared `t(key, values)` ([02](issues/02-choose-icu-stack.md)) |
| Catalog home | `packages/i18n`; namespaces by surface; `/analytics` → `analytics.*` ([03](issues/03-shared-catalog-ownership.md)) |
| Achievements / server labels | Stable ids → catalog keys; client `t()` for display ([04](issues/04-achievement-string-authority.md)) |
| Apply semantics | `localStorage` + cookie; `document.documentElement.lang`; immediate client re-render; SSR reads cookie ([05](issues/05-locale-apply-semantics.md)) |
| Authored vs product | Legal bodies English; legal/ack chrome in catalogs; marquee authored; advertise fields authored; `/advertise` product UI in catalogs ([06](issues/06-authored-vs-product-copy.md), 3A) |
| Ongoing rule | Principle in `docs/THE-LARGER-SYSTEM.md` + checklist in `docs/process.md` ([07](issues/07-ongoing-feature-rule.md)) |
| Tracer | Skip throwaway prototype; production Player Menu Language row ([08](issues/08-language-chooser-prototype.md)) |
| Draft translations | Agent drafts `tr` / `pt-BR` (2A); native review later |
| Execution depth | Implement as far as possible (1B), not map-only |
| Resolution order | Explicit Locale Preference → browser best match among Supported Locales → `en` |
| Language control v1 | Player Menu only (guest + full) |
| Admin | `/admin/*` English-only |

**Glossary:** Locale Preference (stored player choice), Supported Locale (`en` / `tr` / `pt-BR`), Message Catalog (keyed strings per locale in `packages/i18n`).

## Testing

- Changing Language in Player Menu updates preference, `lang`, and mounted chrome without requiring a full reload when practical.
- Cookie and `localStorage` stay aligned; SSR non-admin HTML respects cookie (and `Accept-Language` / `en` fallbacks).
- Missing `tr` / `pt-BR` keys render the English string, never the key id.
- Achievement (and similar) player UI resolves via `t(achievements.<id>…)` from stable ids.
- Legal pages: chrome localized; body remains English.
- Marquee and user-authored advertise fields unchanged by locale.
- `/admin/*` remains English; no catalog requirement.

## Out of scope

- `/admin/*` and admin-only overlays.
- User-authored content (chat, usernames, signboards, voxels, player campaign fields).
- Third-party chrome (Nimiq Hub, Pay SDK).
- Legal body translation in v1.
- Admin-authored marquee translation.
- Main-menu / site-footer language controls; account-synced Locale Preference; `pt-PT`; RTL; automated extraction / pseudo-locale CI as hard requirements.
- Throwaway language-chooser prototype.
