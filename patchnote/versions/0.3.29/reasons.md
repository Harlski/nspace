# Reasons — 0.3.29 (patch-notes version)

**Patch-notes version:** `0.3.29` (frozen via `npm run prepare-merge`).

**Role:** Technical **reasons** attached to **this** patch-notes version — file-level and behavior-level inventory. Public-facing copy at other depths lives only under [public/](public/).

---

## Summary

_Add a one-line roll-up here when the buffer gets long._

---

## By area

### Repo / docs

- _(none yet)_

### Client

- **Campaign billboard view radius `7 -> 14` tiles** ([client/src/game/campaignBillboardVisibility.ts](../../../client/src/game/campaignBillboardVisibility.ts) `CAMPAIGN_BILLBOARD_VISIBILITY_RADIUS_TILES`). More nearby players count as viewers, so impressions/drain accrue faster (visibility is computed client-side; server trusts reported `visibleMs`).

### Server

- **End-of-day stats report to Telegram** ([server/src/dailyStatsReport.ts](../../../server/src/dailyStatsReport.ts), new). Once-per-UTC-day scheduler (`startDailyStatsScheduler`, fires ~00:02 UTC for the day that just ended) that builds a plain-text summary and pushes it via `sendTelegramPlainText`. Wired in [server/src/index.ts](../../../server/src/index.ts) next to `startNimPayoutProcessor()`.
- **Daily aggregate** `getDailyStatsAggregate(dayStartMs, dayEndMs, lookbackDays)` ([server/src/eventLog.ts](../../../server/src/eventLog.ts)). Single pass over event JSONL: unique sign-ins, new users (first-ever `session_start` within the lookback, not bounded by the 30-day analytics cap), Nimiq Pay vs other split (per-wallet), payouts sent + total luna→NIM, and active in-game time (reuses the 5-min capped-gap estimate; only day-started sessions that ended).
- **`nimiqPay` on `session_start`** — `beginSession(address, roomId, { nimiqPay })` now records the login method in the event payload; threaded from `addClient` via `sessionFlags.nimiqPay` ([server/src/eventLog.ts](../../../server/src/eventLog.ts), [server/src/rooms.ts](../../../server/src/rooms.ts)). Pay vs other split is accurate from deploy date onward.
- **Telegram helper** ([server/src/telegramNotify.ts](../../../server/src/telegramNotify.ts)) — `sendTelegramPlainText` gained an optional `chatIdOverride`; new `isTelegramConfigured()` export.
- **Manual trigger** `POST /api/admin/daily-stats/send?day=YYYY-MM-DD&send=1` ([server/src/index.ts](../../../server/src/index.ts), `requireAnalyticsWalletAdmin`) to preview/send a report on demand.
- **Rolling 24h trigger from `/admin/system`** — `buildRolling24hReport` / `sendRolling24hReport` ([server/src/dailyStatsReport.ts](../../../server/src/dailyStatsReport.ts)) over a `[now-24h, now)` window; new endpoint `POST /api/admin/system/daily-stats/send` (`?preview=1`, `requireSystemAdminWallet`) and a **Send last 24h to Telegram** + **Preview** button on the System page ([server/src/adminSystemPage.ts](../../../server/src/adminSystemPage.ts)). Message formatting refactored to accept an explicit header label.
- **Campaign drain rate `x4`** — `CAMPAIGN_NIM_PER_24H_VISIBLE_DEFAULT` `100 -> 400` ([server/src/campaignVisibilityEconomics.ts](../../../server/src/campaignVisibilityEconomics.ts)), i.e. per-second drain ~115 -> ~462 luna/s. With the wider radius this targets ~24h of real exposure per 100 NIM (was ~12 days) while keeping the audience-scaled per-viewer model. All economics (`campaignVisibilityLunaPerSecond`, estimate API, `exampleFundNim24h`) derive from this constant; copy in [advertisePage.ts](../../../server/src/advertisePage.ts) / [adminCampaignPage.ts](../../../server/src/adminCampaignPage.ts) / [advertiseGuidePage.ts](../../../server/src/advertiseGuidePage.ts) updated (rate label is mostly dynamic; "7 blocks" -> "14 blocks").

### payment-intent-service

- _(none in this change set)_

### Deploy / ops

- New optional env vars: `DAILY_STATS_TELEGRAM_ENABLED` (default on when Telegram configured), `DAILY_STATS_TELEGRAM_CHAT_ID`, `DAILY_STATS_LOOKBACK_DAYS` (default 400). Documented in [server/.env.example](../../../server/.env.example) and [docs/process.md](../../../docs/process.md).
- `CAMPAIGN_NIM_PER_24H_VISIBLE` default raised `100 -> 400` (the campaign drain rate). Still tunable live via env (`CAMPAIGN_NIM_PER_24H_VISIBLE` or `CAMPAIGN_VISIBILITY_NIM_PER_MINUTE`) without redeploy; updated in [server/.env.example](../../../server/.env.example).
