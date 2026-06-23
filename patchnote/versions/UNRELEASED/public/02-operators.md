# Public patch notes — operators (`UNRELEASED`)

**Audience:** self-hosters, deployers, infra — Docker, env vars, migrations, breaking ops changes.  
**Depth:** concrete steps, new/removed variables, compose profiles, backup/restart expectations.

---

- **Play Space templates** persist in `play-space-templates.json` under `WORLD_STATE_DIR` (default `server/data/`). Back up with other world JSON.
- **Admin UI:** `/admin/rooms` → **Play Space templates** — create from a source room snapshot, set default, resync (updates future spaces only), archive.
- **Admin API:** `GET/POST/PATCH /api/admin/play-space-templates`, `POST …/:id/resync` (system-admin JWT). `POST /api/invite/create` accepts optional `templateId` for admins only.
- Invite-lobby room geometry is no longer written to world persistence.
