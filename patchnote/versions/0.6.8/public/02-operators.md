# Public patch notes — operators (`0.6.8`)

**Audience:** self-hosters, deployers, infra — Docker, env vars, migrations, breaking ops changes.  
**Depth:** concrete steps, new/removed variables, compose profiles, backup/restart expectations.

---

- [FIX] `/admin/rooms` can add builders to **Tutorial Room** / **Tutorial Staging** (was rejected as "Not an official room id"). Env `TUTORIAL_BUILDER_ALLOWLIST` still works as an additional allowlist.
- [OPS] No new production env vars or compose changes. Local `npm run dev` on Windows now loads `JWT_SECRET` / `DEV_AUTH_BYPASS` from `server/.env` (created/repaired from `.env.example` by the payout bootstrap script).
