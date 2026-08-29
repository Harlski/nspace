# Public patch notes — operators (`0.8.2`)

**Audience:** self-hosters, deployers, infra — Docker, env vars, migrations, breaking ops changes.  
**Depth:** concrete steps, new/removed variables, compose profiles, backup/restart expectations.

---

- [OPS] New env `MOSQUITO_TAG_ENABLED` (server) and `VITE_MOSQUITO_TAG_ENABLED` (client). Both **on unless** `0` / `false` / `off` / `no`. Distinct from `WORLDCUP_ENABLED` (turning World Cup off still leaves Mosquito Tag on the Games Wheel). Rebuild the SPA after toggling the Vite flag. No Docker compose, migration, or default-off change.
