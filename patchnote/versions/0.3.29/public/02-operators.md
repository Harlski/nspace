# Public patch notes — operators (`0.3.29`)

**Audience:** self-hosters, deployers, infra — Docker, env vars, migrations, breaking ops changes.  
**Depth:** concrete steps, new/removed variables, compose profiles, backup/restart expectations.

---

- **End-of-day stats report to Telegram (UTC).** When `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` are set, the server now posts a daily summary shortly after 00:00 UTC for the day that just ended: unique sign-ins, new users, Nimiq Pay vs other, NIM paid out, and active in-game time (excludes long AFK).
  - New env vars (all optional): `DAILY_STATS_TELEGRAM_ENABLED` (default on when Telegram is configured; set `0` to disable), `DAILY_STATS_TELEGRAM_CHAT_ID` (send to a different chat), `DAILY_STATS_LOOKBACK_DAYS` (event-log days scanned for "new users", default 400).
  - Verify without waiting for midnight: `POST /api/admin/daily-stats/send?day=YYYY-MM-DD&send=1` (analytics admin wallet); omit `send=1` to preview the JSON + message only.
  - **`/admin/system`** now has a **Send last 24h to Telegram** button (plus **Preview**) that reports the rolling last 24 hours on demand (`POST /api/admin/system/daily-stats/send`, system admin wallet).
  - Notes: the Nimiq Pay vs other split only reflects sign-ins after this release; "active time" is an action-gap estimate (gaps capped at 5 min), not true window-focus tracking; "new users" accuracy depends on event logs retained within the lookback window.
- **Advertise drawdown recalibrated.** Campaign billboard view radius widened 7 -> 14 tiles, and the default on-screen rate raised `CAMPAIGN_NIM_PER_24H_VISIBLE` `100 -> 400` (per-second drain ~4x). Net effect: a 100 NIM campaign now drains in roughly a day of real exposure instead of ~12 days.
  - Tunable live (no redeploy) via `CAMPAIGN_NIM_PER_24H_VISIBLE` (or `CAMPAIGN_VISIBILITY_NIM_PER_MINUTE`); raise it further if competition among many concurrent campaigns slows individual burn. The view radius is a client build constant.
