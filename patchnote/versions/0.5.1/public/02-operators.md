# Public patch notes — operators (`0.5.1`)

**Audience:** self-hosters, deployers, infra — Docker, env vars, migrations, breaking ops changes.  
**Depth:** concrete steps, new/removed variables, compose profiles, backup/restart expectations.

---

- **[NEW] Mining Restriction** — Game admins can block a wallet from claimable-block NIM via in-game profile **Actions** or **`/admin/moderation`**. Stored in `moderation.json` (`miningBanned`, optional admin `note`). Guests never receive block-claim NIM regardless.
- **[NEW] Connect Notices (Telegram)** — When `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` are set, a enriched ping fires on **fresh sign-in** only (wallet auth or guest invite claim), at most once per wallet/guest per 15 minutes. Includes display name, room/global player counts, last-visit and today-UTC NIM + active time, co-presence usernames, sanction flags, and **`/admin/moderation?wallet=…`** deeplink (guests link to the Play Space host).
- **[NEW] `GAME_SERVER_INTERNAL_URL`** (payout-service) — Base URL of the game server for `nim_payout_sent` analytics callbacks (`POST /api/internal/payout-analytics/sent`). Compose default: `http://nspace:3001`. Requires the same **`PAYOUT_SERVICE_API_SECRET`** bearer on both sides.
- **[NEW] `PAYOUT_ANALYTICS_BACKFILL_SINCE_MS`** (game server, optional) — On startup, backfill `nim_payout_sent` rows from payout-service sent history into the gameplay event log (UTC ms; default cutover ~2026-06-21).
- **[NEW] `PAYOUT_ANALYTICS_SYNC_DIR`** (game server, optional) — Override for dedupe state when recording payout analytics (`server/data/payout-analytics/` by default).
- **[OPS] Deploy order** — Bump **game server**, **payout-service**, and **client** together when using mining-restriction UX, payout analytics callbacks, or Connect Notices.
