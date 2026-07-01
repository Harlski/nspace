# Reasons — 0.5.1 (patch-notes version)

**Patch-notes version:** `0.5.1` (frozen via `npm run prepare-merge`).

**Role:** Technical **reasons** attached to **this** patch-notes version — file-level and behavior-level inventory. Public-facing copy at other depths lives only under [public/](public/).

---

## Summary

**0.5.1** — Admin **Mining Restriction** + guest block-claim denial; client claim-bar hints from `welcome.blockClaimDeniedReason`; enriched **Connect Notice** Telegram on fresh sign-in; payout-service → game-server **payout analytics bridge** (callbacks + backfill); moderation **`?wallet=`** deeplink; profile/Player Menu layering fix.

---

## By area

### Repo / docs

- `CONTEXT.md` — **Connect Notice**, **Mining Restriction** glossary entries.
- `docs/features-checklist.md`, `docs/process.md` — mining restriction, Connect Notices, Telegram behavior.

### Client

- `client/src/main.ts` — `blockClaimDeniedReason` from welcome; `nimClaimProgressFromAdjacent` hint-only denied mode; mining/guest claim loop guards; `onSelfProfileFlags` callback.
- `client/src/net/ws.ts` — `welcome.blockClaimDeniedReason` type.
- `client/src/ui/hud.ts` — claim progress hint/denied; Player Menu elevation when self profile open (`player-menu--elevated`); mining note removed from profile sheet (moved to claim bar).
- `client/src/style.css` — `.player-menu--elevated` stacking.

### Server

- `server/src/blockClaimAccess.ts` — mining ban + guest checks; shared denial messages.
- `server/src/moderationStore.ts` — `miningBanned` + optional `note`; `isMiningBanned`.
- `server/src/adminModerationPage.ts` — `/admin/moderation` shell; `?wallet=` pre-select + actions panel for clean wallets.
- `server/src/index.ts` — moderation routes; `markWalletConnectNoticePending` on auth verify; `maybeSendConnectNotice` on WS connect.
- `server/src/connectNotice.ts` — pending flags, 15m dedupe, message builder, Telegram send.
- `server/src/eventLog.ts` — `getConnectNoticeStatsForAddress` (last visit + today UTC NIM/active).
- `server/src/rooms.ts` — `welcome.blockClaimDeniedReason`; export `countOnlineRealPlayers`, `getCoPresencePlayerLabelsInRoom`.
- `server/src/directInvite/httpHandlers.ts` — guest Connect Notice pending on redeem + nickname.
- `server/src/payoutAnalyticsBridge.ts` — internal analytics ingest + startup backfill.
- `server/src/payoutServiceClient.ts` — `fetchSentHistoryFromService` / `GET /v1/sent-history` client.
- `server/test/connectNotice.test.ts`, `server/test/payoutAnalyticsBridge.test.ts`, `server/test/moderationStore.test.ts`.

### payout-service

- `payout-service/src/analyticsCallback.ts` — POST sent rows to game server after on-chain send.
- `payout-service/src/history.ts` — sent history rows for backfill API.
- `payout-service/src/app.ts` — `GET /v1/sent-history`; wire analytics callback from queue.
- `payout-service/src/config.ts` — `GAME_SERVER_INTERNAL_URL`.

### payment-intent-service

- _(none in this change set)_

### Deploy / ops

- `docker-compose.yml` — `GAME_SERVER_INTERNAL_URL` on payout-service.
- `server/.env.example` — `PAYOUT_ANALYTICS_BACKFILL_SINCE_MS`.
- `payout-service/.env.example` — `GAME_SERVER_INTERNAL_URL`.
