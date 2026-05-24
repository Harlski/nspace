# Public patch notes — operators (`0.3.17`)

**Audience:** self-hosters, deployers, infra — Docker, env vars, migrations, backups, breaking ops changes.  
**Depth:** concrete steps, new/removed variables, compose profiles, backup/restart expectations.

---

- **[OPS]** Deploy **client and server from the same release**. Older worlds load without manual migration: legacy extra-floor entries (plain `"x,z"` strings) keep working and default to the standard extra-floor green; split `data/rooms/*.json` files that omitted tiles can still merge extra floor from legacy **`world-state.json`** on startup.
- **[OPS]** Persisted room data may now include **`baseFloorColors`** (core-grid floor tints) and **`colorRgb`** on extra-floor entries. No new environment variables. Existing backup / restore flow unchanged—stop the stack, tarball `data/`, upgrade, start.
