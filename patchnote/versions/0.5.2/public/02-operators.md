# Public patch notes — operators (`0.5.2`)

**Audience:** self-hosters, deployers, infra — Docker, env vars, migrations, breaking ops changes.  
**Depth:** concrete steps, new/removed variables, compose profiles, backup/restart expectations.

---

- **[FIX] Connect Notices** — Fresh wallet login and guest invite entry now tag the first game WebSocket with `signIn=1`, so Telegram pings still fire if the auth pending window expired during the username prompt. Wallet pending TTL matches guest (5 minutes).
- **[FIX] Telegram delivery** — Connect Notices only record dedupe after a successful send; failed API calls log status/body and can retry on the next eligible sign-in. Env values wrapped in quotes are stripped; missing `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` logs a clear warning.
- **[OPS] Deploy** — Bump **game server** and **client** together when using Connect Notice fixes.
