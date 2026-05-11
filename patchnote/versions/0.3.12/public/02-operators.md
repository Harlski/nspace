# Public patch notes — operators (`0.3.12`)

**Audience:** self-hosters, deployers, infra — Docker, env vars, migrations, breaking ops changes.  
**Depth:** concrete steps, new/removed variables, compose profiles, backup/restart expectations.

---

- **[OPS]** **Optional** server env **`DEPLOY_RESTART_HOOK_SECRET`** (≥16 chars, in host `.env` next to Compose): enables **`POST /api/hooks/pre-deploy-restart`** for scripted / CI restarts. No compose profile changes. **Chat backlog** stays **in-memory** and clears on **process restart** (same class of reset as live positions).
- **[OPS]** **POST /api/admin/announce-restart** — same **game-admin JWT** as other `/api/admin/*` routes (`ADMIN_ADDRESSES`). JSON body **`{ "etaSeconds": number, "message"?: string }`** with **`etaSeconds` between 5 and 7200** (seconds). The server **broadcasts** a WebSocket **`serverNotice`** / **`restart_pending`** to **every** connected game client, then performs a normal **graceful shutdown** when the countdown finishes. Calling it again **replaces** the previous timer. Pair with your deploy stop/restart so players see the banner before the socket drops.
- **[OPS]** **GitHub → Docker deploy** ([`.github/workflows/deploy-docker.yml`](../../../.github/workflows/deploy-docker.yml)): if **`DEPLOY_RESTART_HOOK_SECRET`** (≥16 chars) is present in the server’s **`.env`** next to `docker-compose.yml`, the SSH script calls **`POST /api/hooks/pre-deploy-restart`** on **`http://127.0.0.1:3001`** with **`Authorization: Bearer <secret>`** and a **60s** JSON payload, then **`sleep 60`**, before **`docker compose stop`**. Unset secret = previous behavior (no wait). See [docs/deploy-github-docker.md](../../../docs/deploy-github-docker.md).
