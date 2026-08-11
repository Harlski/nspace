# Public patch notes — operators (`UNRELEASED`)

**Audience:** self-hosters, deployers, infra — Docker, env vars, migrations, breaking ops changes.  
**Depth:** concrete steps, new/removed variables, compose profiles, backup/restart expectations.

---

_(Draft — not published.)_

- **[OPS]** **Rebuild payout (+ payment-intent) after `@nimiq/core` 2.7.2** — mainnet seeds no longer offer ZKP sync; images still on **2.2.2** will hang on consensus (`/v1/balance`, sends) with `Requesting zkp` peer drops. Redeploy sidecars from this release; no new env vars. The old `patches/@nimiq+core+2.2.2.patch` is removed (not applicable to 2.7.2).
