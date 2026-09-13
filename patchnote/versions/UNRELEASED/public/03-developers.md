# Public patch notes — developers (`UNRELEASED`)

**Audience:** contributors and integrators — APIs, WS messages, module boundaries, notable refactors.  
**Depth:** summarized technical changelog; not a full file list (that stays in [../reasons.md](../reasons.md)).

---

_(Draft — not published.)_

- [NEW] `POST /api/live-events` — wallet JWT from `LIVE_EVENT_ADDRESSES`; envelope `{ id, type, occurredAt, source: "nimiqlive", payload }`. Duplicate `id` → **409** `{ ok: true, duplicate: true }`. Unknown `type` → **200** accepted, no World Effect.
- [NEW] WS `liveWorldEffect` + `welcome.liveWorldEffect` (`kind: "live_boost"`, `earnMultiplier`, `untilMs`, `serverNowMs`).

