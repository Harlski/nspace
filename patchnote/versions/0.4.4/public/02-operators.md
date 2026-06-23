# Public patch notes — operators (`0.4.4`)

**Audience:** self-hosters, deployers, infra — Docker, env vars, migrations, breaking ops changes.  
**Depth:** concrete steps, new/removed variables, compose profiles, backup/restart expectations.

---

- [OPS] **Play Space templates** persist in `play-space-templates.json` under `WORLD_STATE_DIR` (default `server/data/`). Back up with other world JSON.
- [NEW] **Admin UI — Rooms:** `/admin/rooms` → **Play Space templates** — pick a source room from the live list (with preview), create a template, set default, resync (updates future spaces only), archive.
- [NEW] **Admin API — templates:** `GET/POST/PATCH /api/admin/play-space-templates`, `POST …/:id/resync` (system-admin JWT). `POST /api/invite/create` accepts optional `templateId` for admins only.
- [NEW] **Admin chat log:** `/admin/chat` + `GET /api/admin/chat` / `GET /api/admin/chat/message` (system admin) — search global, by room, or by wallet (7-day default, 30-day max); censored text with optional original; inline channel mute and feedback link.
- [OPS] Invite-lobby room geometry is no longer written to world persistence.
