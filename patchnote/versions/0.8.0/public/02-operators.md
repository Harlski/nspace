# Public patch notes — operators (`0.8.0`)

**Audience:** self-hosters, deployers, infra — Docker, env vars, migrations, breaking ops changes.  
**Depth:** concrete steps, new/removed variables, compose profiles, backup/restart expectations.

---

- [OPS] Localization ships with the monorepo build: workspace package `@nspace/i18n` is built **before** client and server. No new env vars for Locale Preference.
- [OPS] Locale Preference is stored in the browser (`localStorage` + cookie `nspace_locale`). Non-admin SSR pages (e.g. `/payouts`) can read that cookie; `/admin/*` stays English-only.
- [OPS] Draft Turkish / Brazilian Portuguese strings ship in-repo but await **native review** before treating them as final copy.
