# Public patch notes — operators (`UNRELEASED`)

**Audience:** self-hosters, deployers, infra — Docker, env vars, migrations, breaking ops changes.  
**Depth:** concrete steps, new/removed variables, compose profiles, backup/restart expectations.

---

- No new environment variables.
- Local install: use **Node 22 LTS** (`.nvmrc`) if `better-sqlite3` fails to compile on a newer Node; repo now depends on `better-sqlite3` ^12.11.1 for Node 20–26.
- Ensure SPA hosting rewrites **`/auth/qr/:ticket`** to the client `index.html` (already added in root and `client/vercel.json`). Game API routes under `/api/auth/qr-login*` are covered by existing `/api/:path*` proxies.
- QR login tickets are **in-memory** on the game server (same class as auth nonces): lost on restart; TTL 5 minutes.
