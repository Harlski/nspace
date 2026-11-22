# Public patch notes — operators (`0.9.3`)

**Audience:** self-hosters, deployers, infra — Docker, env vars, migrations, breaking ops changes.  
**Depth:** concrete steps, new/removed variables, compose profiles, backup/restart expectations.

---

- [OPS] Public Rooms is builtin room `directory`. No new env var. Restart the game server so the hall is created. Admin builds and moved teleporters are saved in the world files with the other rooms.
- [FIX] No new env var and no migration. Restart the game server so wallet sign-in stops closing the socket for players who already have a username.
- [FIX] Restart the game server and the Analytics Service so dossier login history and today's activity include players whose event-log address still has spaces. No new env vars.
- [OPS] Player dossier `/admin/user/:profile` now includes login history for the last 24 hours (switch to 7 days on the page). The chart shows when they were connected, when they were active, and gameplay NIM. It needs the Analytics Service; if that sidecar is down, the chart says so and the rest of the dossier still loads. No new env vars.
