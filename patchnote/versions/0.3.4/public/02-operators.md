# Public patch notes — operators (`0.3.4`)

**Audience:** self-hosters, deployers, infra — Docker, env vars, migrations, breaking ops changes.  
**Depth:** concrete steps, new/removed variables, compose profiles, backup/restart expectations.

---

- **Room registry file format** advances to **v6** for persisted `joinSpawnX` / `joinSpawnZ` on rooms. Back up `data/` (or your configured registry path) before deploying; older files are upgraded on load when supported.
- **Header marquee:** optional `GET /api/header-marquee` and admin UI at `/admin/header` for messages and timing; ensure reverse proxies forward those routes to the API host if you split static and API (see **Vercel** example rewrites in the repo for `/admin/header`).
- **No new required env vars** for this slice beyond what you already use for auth, persistence, and admin; payment-intent-service unchanged in this release bucket.
