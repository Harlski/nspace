# Public patch notes — operators (`0.6.1`)

**Audience:** self-hosters, deployers, infra — Docker, env vars, migrations, breaking ops changes.  
**Depth:** concrete steps, new/removed variables, compose profiles, backup/restart expectations.

---

- [FIX] **Payout outbox stall** — delivered lines no longer accumulate forever in `data/payout-outbox/outbox.jsonl`. On startup (and after each successful drain) the file is compacted to undelivered intents only; the 2s delivery loop keeps pending work in memory. Live symptom was regular `[event-loop] stall ~400–500 ms` every ~2.5s while idle. After deploy, look for `[payout-outbox] Compacted outbox.jsonl: N → M undelivered`. Optional one-time relief before deploy: if `delivered-claim-ids.json` already lists every claim, you may empty `outbox.jsonl` after backup (leave the delivered-ids file alone).
- [NEW] **`ANALYTICS_OVERVIEW_CACHE_TTL_MS`** — in-memory TTL for `GET /api/analytics/overview` (default **120000** = 2 min). Set **`0`** to disable. Speeds repeated 7/30-day analytics loads.
- [CHANGE] Default Tutorial Template bootstrap is the portrait Tutorial Path (7×15). Deploys that already persisted a tutorial template keep the old layout until you republish from Tutorial Staging (or remove the stored template so bootstrap recreates the default).
- [NEW] Attention Markers persist in room geometry JSON (`attentionMarkers`) and in Tutorial / Play Space Build Shells — republish templates after placing markers in staging.
- [OPS] Optional **`PAYOUT_OUTBOX_PARSE_WARN_MS`** (default **50**) logs a warning when a sync outbox parse is still slow after compaction.
