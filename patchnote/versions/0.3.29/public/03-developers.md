# Public patch notes — developers (`0.3.29`)

**Audience:** contributors and integrators — APIs, WS messages, module boundaries, notable refactors.  
**Depth:** summarized technical changelog; not a full file list (that stays in [../reasons.md](../reasons.md)).

---

- **Daily stats Telegram report** ([server/src/dailyStatsReport.ts](../../../../server/src/dailyStatsReport.ts)): `startDailyStatsScheduler()` runs once per UTC day (~00:02 UTC) and sends a plain-text summary via `sendTelegramPlainText`.
- **`getDailyStatsAggregate(dayStartMs, dayEndMs, lookbackDays)`** in [server/src/eventLog.ts](../../../../server/src/eventLog.ts): single-pass day rollup (unique/new sign-ins, Nimiq Pay split, payouts, capped-gap active play time) independent of the analytics snapshot's 30-day cap.
- **`session_start` now carries `payload.nimiqPay`** when the session was authenticated via Nimiq Pay (`beginSession` gained an `opts.nimiqPay`; threaded from `addClient`).
- **`sendTelegramPlainText(text, logTag, chatIdOverride?)`** + new `isTelegramConfigured()` ([server/src/telegramNotify.ts](../../../../server/src/telegramNotify.ts)).
- **`POST /api/admin/daily-stats/send`** (`requireAnalyticsWalletAdmin`): `day=YYYY-MM-DD` (defaults to previous UTC day), `send=1` to push to Telegram; returns `{ sent, aggregate, message }`.
- **`POST /api/admin/system/daily-stats/send`** (`requireSystemAdminWallet`): reports the **rolling last 24 hours**; `preview=1` builds without sending. Backed by `buildRolling24hReport` / `sendRolling24hReport`, and surfaced as a button on `/admin/system`.
- **Advertise economics retune** ([server/src/campaignVisibilityEconomics.ts](../../../../server/src/campaignVisibilityEconomics.ts), [client/src/game/campaignBillboardVisibility.ts](../../../../client/src/game/campaignBillboardVisibility.ts)): `CAMPAIGN_NIM_PER_24H_VISIBLE_DEFAULT` `100 -> 400` (per-second drain ~115 -> ~462 luna) and `CAMPAIGN_BILLBOARD_VISIBILITY_RADIUS_TILES` `7 -> 14`. Rate stays env-tunable (`CAMPAIGN_NIM_PER_24H_VISIBLE` / `CAMPAIGN_VISIBILITY_NIM_PER_MINUTE`); estimate API and UI copy derive from the constant.
