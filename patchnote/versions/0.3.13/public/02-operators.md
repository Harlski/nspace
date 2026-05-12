# Public patch notes — operators (`0.3.13`)

**Audience:** self-hosters, deployers, infra — Docker, env vars, migrations, breaking ops changes.  
**Depth:** concrete steps, new/removed variables, compose profiles, backup/restart expectations.

---

- [OPS] **GitHub Actions → VPS deploy** — the step that calls the server’s pre-deploy restart hook no longer treats **HTTP 404** as a hard failure (first deploy before the hook exists, or hook disabled with `not_configured`). **200** still waits up to **60s** for the server to drain; **404** skips quickly; other status codes wait **5s** then continue. No new environment variables.
