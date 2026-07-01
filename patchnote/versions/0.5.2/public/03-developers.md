# Public patch notes — developers (`0.5.2`)

**Audience:** contributors and integrators — APIs, WS messages, module boundaries, notable refactors.  
**Depth:** summarized technical changelog; not a full file list (that stays in [../reasons.md](../reasons.md)).

---

- **[CHANGE] WS connect** — Client may pass `signIn=1` on the first game WebSocket after wallet auth or guest invite redeem (not reconnect/resume). Server reads `signInRequested` in [connectNotice.ts](../../../server/src/connectNotice.ts) and falls back to a synthetic pending notice when auth pending was consumed or expired.
- **[CHANGE] Connect Notice pending** — `CONNECT_NOTICE_WALLET_PENDING_TTL_MS` raised to 5 minutes; `resolveConnectNoticePending` unifies auth-pending consume + sign-in fallback; structured `[connect]` logs for skip/sent paths.
- **[CHANGE] Telegram** — [sendTelegramPlainText](../../../server/src/telegramNotify.ts) returns `boolean`; checks HTTP status and logs API errors; lazy-reads env per call with quote stripping.
