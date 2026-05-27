# Public patch notes — operators (`UNRELEASED`)

**Audience:** self-hosters, deployers, infra — Docker, env vars, migrations, backups, breaking ops changes.  
**Depth:** concrete steps, new/removed variables, compose profiles, backup/restart expectations.

---

- **[OPS]** Ship an updated **client** and **server** together for this bucket (prefab placement rules and extra-floor bounds are authoritative on the server). No migrations or new environment variables.
- **[OPS]** Earlier items in this release (expired-session Re-login, cube rendering) remain **client-only** if you cherry-pick; for the full `UNRELEASED` set, deploy both tiers.
