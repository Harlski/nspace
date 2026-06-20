# Public patch notes — operators (`0.4.1`)

**Audience:** self-hosters, deployers, infra — Docker, env vars, migrations, breaking ops changes.  
**Depth:** concrete steps, new/removed variables, compose profiles, backup/restart expectations.

---

- [OPS] Ship the updated **client and server together** so goal-reward feedback, match-forfeit behavior, and the daily goal recap stay in sync.
- [OPS] **End-of-day Telegram — second message.** When the World Cup feature is on and the UTC day had credited goals, the daily report now sends a **second message** with the goal recap (total goals, podium teams, MVP, top scorers). Uses the same chat and toggles as the stats report (`DAILY_STATS_TELEGRAM_*`); quiet days send only the stats message. Preview both via `POST /api/admin/daily-stats/send?day=YYYY-MM-DD` (response now includes `worldcupMessage`).
- [OPS] **Optional contention / stall diagnostics** (defaults on, no action required):
  - `NIM_MUTEX_LOG_MS` — log `[nim-mutex]` when Nimiq mutex wait or hold exceeds this threshold (default **200** ms; **`0`** logs every acquisition). See [docs/nim-payout-tracing.md](../../../docs/nim-payout-tracing.md).
  - `EVENT_LOOP_STALL_LOG_MS` — log `[event-loop]` stalls to console and `/admin/system` when the Node event loop is blocked ≥ this threshold (default **50** ms; **`0`** disables).
