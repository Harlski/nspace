# Public patch notes — operators (`0.5.6`)

**Audience:** self-hosters, deployers, infra — Docker, env vars, migrations, breaking ops changes.  
**Depth:** concrete steps, new/removed variables, compose profiles, backup/restart expectations.

---

- **[OPS]** **Optional movement rollout** — set **`MOVE_ORDER_BROADCAST=1`** on the game server to dual-send **`moveOrder`** / **`moveAbort`** WebSocket messages on validated walks and stop streaming pose in tick **`stateDelta`** for active grid path walkers (reduces bandwidth; clients animate from the path). Default is **off** — no behavior change until you opt in. **`ANALYTIC_PATH_SKIP_STEPPING=1`** is also implied when move-order broadcast is on (see [docs/process.md](../../../../docs/process.md)).
- **[OPS]** **`WORLDCUP_GOALIE_BROADCAST_MIN_MS`** — optional throttle for World Cup **`goalieState`** broadcasts (default **250** ms). Goalie wire is now sent on room join/teleport and only re-broadcast when positions actually change.
- **[OPS]** **Payout analytics bridge (game server boot)** — the game server now registers **`POST /internal/v1/payout-analytics-events`** and runs startup backfill sync. Payout-service must have **`GAME_SERVER_INTERNAL_URL`** pointing at the game server and the same **`PAYOUT_SERVICE_API_SECRET`** bearer on both sides. Optional **`PAYOUT_ANALYTICS_BACKFILL_SINCE_MS`** (UTC ms cutover for historical sent rows) and **`PAYOUT_ANALYTICS_SYNC_DIR`** (dedupe state directory; default under `server/data/payout-analytics/`).
- No data migrations or compose profile changes. Rebuild and restart the server (and client bundle if you ship static assets separately) as usual.
