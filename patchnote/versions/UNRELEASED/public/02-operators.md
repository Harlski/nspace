# Public patch notes — operators (`UNRELEASED`)

**Audience:** self-hosters, deployers, infra — Docker, env vars, migrations, breaking ops changes.  
**Depth:** concrete steps, new/removed variables, compose profiles, backup/restart expectations.

---

_(Draft — not published.)_

- **[OPS]** **`MOVE_ORDER_BROADCAST` default flipped on** — Path Playback dual-send
  (`moveOrder` / `moveAbort`, omit walker pose from tick `stateDelta` in click-to-walk rooms)
  is now the default. Set **`MOVE_ORDER_BROADCAST=0`** on the game server to revert to the
  old snapshot pose stream. Bare/unset env gets the new behavior (no need to set `=1`).
  Analytic path pose skip stays tied to Path Playback being enabled.
- **[OPS]** **Analytics Service sidecar (default)** — Event Log scans for `/analytics`
  overview and the daily-stats Telegram aggregate moved out of the game process.
  Compose service **`analytics`** on `127.0.0.1:3092`, read-only mount of `./data/events`.
  Game env: `ANALYTICS_SERVICE_URL=http://analytics:3092` (compose default) and
  `ANALYTICS_SERVICE_API_SECRET` (same secret on `analytics-service/.env`).
  The game does **not** wait for this container; `/analytics` returns 503 if it is down.
  Local: included in `npm run dev` (port 3092). See
  [adr/0016-analytics-service-sidecar.md](../../../../docs/adr/0016-analytics-service-sidecar.md).
