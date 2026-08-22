---
Type: research
Status: resolved
Blocked by:
---

# Choose ICU-capable i18n stack for Vite + Express

## Question

For a **vanilla TypeScript** Vite client and Express server (npm workspaces, no React in the game client), which **ICU MessageFormat**-capable approach should we standardize on for a shared `t(key, values)` API?

Compare at least: `i18next` + `i18next-icu` (or equivalent), and `@formatjs/intl` / `intl-messageformat`. Judge on: ICU completeness (plurals/selects), locale switching at runtime, sharing one catalog between client and server, bundle cost, maintenance, and fit with JSON catalogs.

Recommend **one** default for this repo. Cite official docs / package READMEs, not blog roundups.

## Answer

**Default: `@formatjs/intl` (via `intl-messageformat`) behind a thin shared `t(key, values)` wrapper.** Same ICU engine i18next-icu would use; better fit for flat shared JSON catalogs, vanilla client + Express, and smaller install surface. Reject `i18next` + `i18next-icu` as default (plugin disables i18next’s own formatting; extra weight).

Full write-up: [research/02-choose-icu-stack.md](../research/02-choose-icu-stack.md)
