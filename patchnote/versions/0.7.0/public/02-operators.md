# Public patch notes — operators (`0.7.0`)

**Audience:** self-hosters, deployers, infra — Docker, env vars, migrations, breaking ops changes.  
**Depth:** concrete steps, new/removed variables, compose profiles, backup/restart expectations.

---

- [OPS] **`MOVE_ORDER_BROADCAST` default on** — Path Playback dual-send is the default. Set **`MOVE_ORDER_BROADCAST=0`** to revert to the old snapshot pose stream. Bare/unset env gets the new behavior.
- [OPS] **`SHOP_ENABLED` / `VITE_SHOP_ENABLED` default open** — shop is on unless set to `=0`. Runtime gate also follows `/admin/settings` `shopEnabled` (default true).
- [OPS] **Analytics Service sidecar (default)** — Event Log scans for `/analytics` overview and daily-stats Telegram aggregate moved out of the game process. Compose service **`analytics`** on `127.0.0.1:3092`, read-only `./data/events`. Game env: `ANALYTICS_SERVICE_URL` and `ANALYTICS_SERVICE_API_SECRET`. Game does not wait on this container; `/analytics` returns 503 if it is down. Included in `npm run dev`. See [adr/0016](../../../../docs/adr/0016-analytics-service-sidecar.md).
- [OPS] **Admin Invisibility** — allowlisted admins can observe without join/leave noise (`NSPACE_ADMIN_INVISIBLE` / WS `adminInvisible`). World edit stays gated while invisible.
- [OPS] **Admin Freeze** — hitch a target’s locomotion from the Other Player Menu; works while the actor is invisible. Cue is admin-viewer only.
- [OPS] **Sale Displays** — Build → Buildings place/bind/clear/move/delete and walk path; full admin Build in The Shaper; auto Preset gallery retired from Shaper welcome.
- [OPS] **`/admin` Quick payout** — Payable vs Mining Restriction tabs; public `/payouts` omits mining-held jobs from pending display.
- [OPS] **`/admin/system`** probes Analytics Service `GET /health`.
