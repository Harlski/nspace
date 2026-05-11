# Public patch notes — operators (`0.4.0`)

**Audience:** self-hosters, deployers, infra — Docker, env vars, migrations, breaking ops changes.  
**Depth:** concrete steps, new/removed variables, compose profiles, backup/restart expectations.

---

- [CHANGE] Deploy the refreshed client **`dist`** so **`/tacs`** and **`/privacy`** HTML are available from the game server (`GET /tacs`, `GET /privacy`).
- [NEW] **`TERMS_PRIVACY_ACCEPTANCE_STORE_FILE`** — optional path override for Terms/Privacy acknowledgement records (JSON). Default **`server/data/terms-privacy-acceptance.json`**; **`LEGAL_CONSENT_STORE_FILE`** remains a fallback/deprecated alias (`docs/process.md`).
- [OPS] First deploy after upgrading: acknowledgement file is created on demand; legacy **`legal-consent.json`** rows are merged when migrating paths.
