# Public patch notes — operators (`UNRELEASED`)

**Audience:** self-hosters, deployers, infra — Docker, env vars, migrations, breaking ops changes.  
**Depth:** concrete steps, new/removed variables, compose profiles, backup/restart expectations.

---

- [FIX] No new env var and no migration. Restart the game server so wallet sign-in stops closing the socket for players who already have a username.
- [OPS] Player dossier `/admin/user/:profile` now includes login history for the last 24 hours (switch to 7 days on the page). The chart shows when they were connected, when they were active, and gameplay NIM. It needs the Analytics Service; if that sidecar is down, the chart says so and the rest of the dossier still loads. No new env vars.
