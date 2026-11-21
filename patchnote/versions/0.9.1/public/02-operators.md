# Public patch notes — operators (`0.9.1`)

**Audience:** self-hosters, deployers, infra — Docker, env vars, migrations, breaking ops changes.  
**Depth:** concrete steps, new/removed variables, compose profiles, backup/restart expectations.

---

- [CHANGE] **Hourly activity digest.** When `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` are set, the game posts **one** Telegram message about a minute past each UTC hour. It covers the **last 24 hours**: most active players (play time, NIM earned, current room if they are online, sessions, chat), who joined in the last hour, online count, new / guest / Nimiq Pay counts, mines, blocks placed, busiest rooms, and NIM still pending payout. A quiet world still sends a short message.
- [CHANGE] **Per-connect Telegram pings stop.** Walking in, reconnecting, or crossing a door no longer sends its own message. Username changes, feedback tickets, campaign approval, and the end-of-day stats report are unchanged.
- [OPS] **Env.** `HOURLY_ACTIVITY_TELEGRAM_ENABLED` defaults **on** when Telegram is configured (`0` turns it off). Optional: `HOURLY_ACTIVITY_TELEGRAM_CHAT_ID`, `HOURLY_ACTIVITY_TOP_N` (default 12, max 25), `HOURLY_ACTIVITY_LOOKBACK_DAYS` (falls back to `DAILY_STATS_LOOKBACK_DAYS`, then 400).
- [OPS] **Analytics Service required** for the digest. If it is down, that hour is skipped and retried once. Play is unaffected.
- [OPS] **`/admin/system`** has **Send hourly digest to Telegram** and **Preview digest**. Preview does not send. `POST /api/admin/system/hourly-activity/send` (`preview=1` to preview only; system admin).
