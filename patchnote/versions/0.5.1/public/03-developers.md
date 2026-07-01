# Public patch notes — developers (`0.5.1`)

**Audience:** contributors and integrators — APIs, WS messages, module boundaries, notable refactors.  
**Depth:** summarized technical changelog; not a full file list (that stays in [../reasons.md](../reasons.md)).

---

- **[NEW] Mining restriction** — `moderationStore` (`miningBanned`); enforced in `blockClaimAccess.ts` at `beginBlockClaim` / `completeBlockClaim`. Admin: `POST /api/admin/moderation` action `mining_ban`; page **`/admin/moderation`** (`?wallet=NQ…` opens actions panel for any wallet). WS **`welcome`** may include **`blockClaimDeniedReason`** when mining is blocked or the session is a guest.
- **[NEW] Connect Notices** — [server/src/connectNotice.ts](../../../server/src/connectNotice.ts): pending flag on `/api/auth/verify` and guest invite redeem/nickname; consumed on first WS connect; [getConnectNoticeStatsForAddress](../../../server/src/eventLog.ts) for last-visit + today-UTC stats; co-presence via [getCoPresencePlayerLabelsInRoom](../../../server/src/rooms.ts).
- **[NEW] Payout analytics bridge** — [server/src/payoutAnalyticsBridge.ts](../../../server/src/payoutAnalyticsBridge.ts): `POST /api/internal/payout-analytics/sent` and `…/dead-letter` (payout-service bearer); startup backfill from `GET /v1/sent-history` on payout-service; dedupe under `PAYOUT_ANALYTICS_SYNC_DIR`. Payout side: [payout-service/src/analyticsCallback.ts](../../../payout-service/src/analyticsCallback.ts) + `GET /v1/sent-history`.
- **[CHANGE] Client claim UX** — [client/src/main.ts](../../../client/src/main.ts) reads `welcome.blockClaimDeniedReason`; [hud.setNimClaimProgress](../../../client/src/ui/hud.ts) supports hint-only **denied** mode.
