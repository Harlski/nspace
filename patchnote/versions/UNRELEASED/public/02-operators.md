# Public patch notes — operators (`UNRELEASED`)

**Audience:** self-hosters, deployers, infra — Docker, env vars, migrations, breaking ops changes.  
**Depth:** concrete steps, new/removed variables, compose profiles, backup/restart expectations.

---

- **[NEW]** Public **`GET /api/ambient-cast`** — no new env vars. Reads today’s UTC Event Log `session_start` rows (excludes Play Space lobbies) and returns Face Tokens only. Ensure Event Log volume is mounted as usual so the Main Menu cast has data after restart.
