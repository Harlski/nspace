# Public patch notes — operators (`0.6.10`)

**Audience:** self-hosters, deployers, infra — Docker, env vars, migrations, breaking ops changes.  
**Depth:** concrete steps, new/removed variables, compose profiles, backup/restart expectations.

---

- [FIX] **`/analytics` Pay returning** no longer stuck at 0 on rolling 7/14/30d windows. Overview scans event logs before the selected range for first-time / returning.
- [NEW] **`ANALYTICS_FIRST_TIME_LOOKBACK_DAYS`** — days of history before the window (default: `DAILY_STATS_LOOKBACK_DAYS` if set, else **400**). Larger values are more accurate but slower; lower them if overview requests time out. Documented in `server/.env.example` and [docs/process.md](../../../docs/process.md).
