# Public patch notes — developers (`0.8.0`)

**Audience:** contributors and integrators — APIs, WS messages, module boundaries, notable refactors.  
**Depth:** summarized technical changelog; not a full file list (that stays in [../reasons.md](../reasons.md)).

---

- [NEW] Workspace package **`@nspace/i18n`** (`packages/i18n`) — `@formatjs/intl`, `t(key)` / `createTranslator`, catalogs `en` / `tr` / `pt-BR`, Locale Preference key `nspace_locale`.
- [NEW] Client bootstrap + Player Menu **Language** row (flag) opens a language popup modal; English recovery title stays visible after locale switch.
- [NEW] Achievements, mining claim bar, daily-earn cinematic/pulse/profile lines, and related chrome use Message Catalog keys with English fallback.
- [NEW] Server helper `requestLocale` / `requestTranslator` for non-admin HTML (cookie → `Accept-Language` → `en`); `/payouts` sets `html lang` and title from catalogs.
- [CHANGE] New player-visible **product** strings: Message Catalog keys in the same change (`en` required; `tr` / `pt-BR` may lag). Exempt: `/admin/*`, user-authored content, third-party Hub/Pay chrome, legal page bodies. See [docs/localization.md](../../../docs/localization.md).
