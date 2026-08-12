# Public patch notes — developers (`UNRELEASED`)

**Audience:** contributors and integrators — APIs, WS messages, module boundaries, notable refactors.  
**Depth:** summarized technical changelog; not a full file list (that stays in [../reasons.md](../reasons.md)).

---

_(Draft — not published.)_

- **`isMoveOrderBroadcastEnabled`** in [`server/src/moveOrderBroadcast.ts`](../../../../server/src/moveOrderBroadcast.ts):
  enabled unless env is exactly `"0"` (was `"1"` only). Wire types unchanged (`moveOrder` /
  `moveAbort`). Client Path Playback for self + remotes in click-to-walk rooms already
  existed; default-on is the ops flip. Glossary: **Path Playback** in `CONTEXT.md`.
- **Analytics Service** workspace [`analytics-service/`](../../../../analytics-service/):
  `GET /v1/overview`, `GET /v1/daily-stats-aggregate` (Bearer
  `ANALYTICS_SERVICE_API_SECRET`). Game client
  [`server/src/analyticsServiceClient.ts`](../../../../server/src/analyticsServiceClient.ts)
  thin-proxies; Event Log writes stay on the game. ADR 0016. No in-process scan fallback.
