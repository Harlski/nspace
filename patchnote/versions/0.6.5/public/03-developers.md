# Public patch notes — developers (`0.6.5`)

**Audience:** contributors and integrators — APIs, WS messages, module boundaries, notable refactors.  
**Depth:** summarized technical changelog; not a full file list (that stays in [../reasons.md](../reasons.md)).

---

- [API] `POST /v1/pay-intents` accepts optional boolean `priority`. When true, the job is selected before any normal pending job (strict priority among ready jobs). Persisted on the queue job; omitted/`false` = normal.
- [CHANGE] Game-server Outbox carries `priority` and delivers priority intents first within each drain. Tutorial faucet enqueue in `rooms.ts` sets `priority: true`.
- [CHANGE] Auto-bulk (`maybeAutoBulkStalePending` / `manualBulkPayoutPendingForRecipient({ excludePriority: true })`) never sweeps priority jobs; flush and admin manual bulk still include them.
- [CHANGE] `hud.setLoadingVisible(false)` resolves when the overlay fade-out finishes; tutorial Hub welcome cinematic awaits that before playing.
