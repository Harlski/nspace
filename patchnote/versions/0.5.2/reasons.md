# Reasons — 0.5.2 (patch-notes version)

**Patch-notes version:** `0.5.2` (frozen via `npm run prepare-merge`).

**Role:** Technical **reasons** attached to **this** patch-notes version — file-level and behavior-level inventory. Public-facing copy at other depths lives only under [public/](public/).

---

## Summary

**0.5.2** — Connect Notice reliability: client `signIn=1` on first WS after fresh login/guest entry; server fallback when auth pending expired; wallet pending TTL 5m; Telegram send success gating + error logging; quoted env trim.

---

## By area

### Repo / docs

- _(none in this change set)_

### Client

- `client/src/main.ts` — `freshSignIn` on wallet auth and guest invite `enterGame`; first `connectToRoom` passes `signIn` to WS.
- `client/src/net/ws.ts` — `ConnectGameWsOptions.signIn`; query `signIn=1`.

### Server

- `server/src/connectNotice.ts` — `CONNECT_NOTICE_WALLET_PENDING_TTL_MS` 5m; `resolveConnectNoticePending` (auth pending + sign-in fallback); `ConnectNoticeWsContext.signInRequested` / `nimiqPay`; structured logs; dedupe only on successful Telegram send.
- `server/src/index.ts` — pass `signInRequested`, `nimiqPay` to `maybeSendConnectNotice`.
- `server/src/telegramNotify.ts` — lazy env read, quote strip, `sendTelegramPlainText` returns boolean, HTTP error logging.
- `server/test/connectNotice.test.ts` — sign-in fallback + dedupe-on-success coverage.

### payout-service

- _(none in this change set)_

### payment-intent-service

- _(none in this change set)_

### Deploy / ops

- _(none in this change set)_
