# Public patch notes — operators (`0.3.2`)

**Audience:** self-hosters, deployers, infra — Docker, env vars, migrations, breaking ops changes.  
**Depth:** concrete steps, new/removed variables, compose profiles, backup/restart expectations.

---

- **Header banner:** Optional persisted JSON for marquee toggles, **`newsMessages[]`** (multi-line rotation), **`marqueeMessageSeconds`** (dwell per message line), and **`marqueeStreakSeconds`** (server-side safety cap if the client never reports finishing a horizontal loop). Paths: default under server data dir; override with **`HEADER_MARQUEE_SETTINGS_FILE`** (and streak ledger with **`LOGIN_STREAK_STORE_FILE`** where applicable — see [server/.env.example](../../../../server/.env.example)).
- **Admin UI:** Configure the strip at **`/admin/header`** (system admin wallet). API: **`GET`/`PUT /api/admin/header-marquee`** (authenticated).
- **Split hosting:** If the static site and API are on different origins, ensure **`/admin/header`** is rewritten to the API host (see Vercel config in repo).
