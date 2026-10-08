# Public patch notes — operators (`UNRELEASED`)

**Audience:** self-hosters, deployers, infra — Docker, env vars, migrations, breaking ops changes.  
**Depth:** concrete steps, new/removed variables, compose profiles, backup/restart expectations.

---

- No new environment variables.
- Ensure SPA hosting rewrites **`/auth/qr/:ticket`** to the client `index.html` (already added in root and `client/vercel.json`). Game API routes under `/api/auth/qr-login*` are covered by existing `/api/:path*` proxies.
- QR login tickets are **in-memory** on the game server (same class as auth nonces): lost on restart; TTL 5 minutes.
