# Public patch notes — operators (`0.8.5`)

**Audience:** self-hosters, deployers, infra — Docker, env vars, migrations, breaking ops changes.  
**Depth:** concrete steps, new/removed variables, compose profiles, backup/restart expectations.

---

- [OPS] No new environment variables. Production QR links use `PUBLIC_BASE_URL` when set, otherwise `https://nimiq.space`.
- [OPS] SPA hosting must rewrite `/auth/qr/:ticket` to the client `index.html` (already in the root and `client/vercel.json`). `/api/auth/qr-login*` is covered by the existing `/api/:path*` proxy.
- [OPS] QR tickets live in memory on the game server for 5 minutes and are dropped on restart. After the computer claims the session, only the address is kept until that same timer ends. The session token is not kept.
- [OPS] Local install: use Node 22 LTS (`.nvmrc`) if `better-sqlite3` fails to compile. The repo depends on `better-sqlite3` ^12.11.1 (Node 20-26). `postinstall` and `npm run dev` build `@nspace/i18n`.
