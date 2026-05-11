# Public patch notes — operators (`0.3.10`)

**Audience:** self-hosters, deployers, infra — Docker, env vars, migrations, breaking ops changes.  
**Depth:** concrete steps, new/removed variables, compose profiles, backup/restart expectations.

---

- [OPS] **Terms/Privacy acknowledgements:** Server stores optional per-wallet acknowledgement JSON (default under `server/data/`, merge-read with legacy `legal-consent.json`). Override path with **`TERMS_PRIVACY_ACCEPTANCE_STORE_FILE`** (alias **`LEGAL_CONSENT_STORE_FILE`**).
- [OPS] **HTTP routes:** Same-origin **`/tacs`** and **`/privacy`** serve the legal HTML alongside the SPA when you use the bundled server or matching static deploy.
