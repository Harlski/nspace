# Reasons — 0.3.27 (patch-notes version)

**Patch-notes version:** `0.3.27` (frozen via `npm run prepare-merge`).

**Role:** Technical **reasons** attached to **this** patch-notes version — file-level and behavior-level inventory. Public-facing copy at other depths lives only under [public/](public/).

---

## Summary

Paid Hub billboard campaigns: `/advertise` portal, prepaid visibility drain, in-game audience analytics, admin rotation sets, live top-ups, balance repair for stale intent double-credit, and public how-it-works guide.

---

## By area

### Repo / docs

- [docs/advertise-guide.md](../../../docs/advertise-guide.md) — operator/contributor guide; links to `/advertise/how-it-works`.
- [docs/features-checklist.md](../../../docs/features-checklist.md) — advertise portal, analytics, Add funds.
- [docs/process.md](../../../docs/process.md) — WS `campaignImpression` / `campaignLinkClick`, drain rules.
- [docs/README.md](../../../docs/README.md) — index entry for advertise guide.

### Client

- [client/src/game/campaignBillboardVisibility.ts](../../../client/src/game/campaignBillboardVisibility.ts) — ~1 s sampler, 5 s batch flush, 7-block proximity, AFK/tab/wallet-send exclusions.
- [client/src/main.ts](../../../client/src/main.ts) — wires impression sampler lifecycle; removed dev **Test Radio mini-app** HUD button.
- [client/src/net/ws.ts](../../../client/src/net/ws.ts) — `campaignImpression`, `campaignLinkClick` message types.
- [client/src/net/miniappDeepLink.ts](../../../client/src/net/miniappDeepLink.ts) — Visit uses HTTPS in Pay WebView.
- [client/src/ui/hud.ts](../../../client/src/ui/hud.ts) — removed dev **Test Radio mini-app** HUD button.

### Server

- [server/src/advertisePage.ts](../../../server/src/advertisePage.ts) — `/advertise` dashboard: New/Existing tabs, fund modal (spinner/tick), prepaid card, audience stats, Add funds, tx history, link to how-it-works.
- [server/src/advertiseGuidePage.ts](../../../server/src/advertiseGuidePage.ts) — **`GET /advertise/how-it-works`** public step-by-step guide.
- [server/src/adminCampaignPage.ts](../../../server/src/adminCampaignPage.ts) — pending/approved/rotations/expired; prepaid + analytics columns.
- [server/src/campaignStore.ts](../../../server/src/campaignStore.ts) — SQLite campaigns + `campaign_transactions`; top-up; `debitCampaignVisibilityLuna`; clear stale intents; `repairInflatedCampaignBalances`.
- [server/src/campaignFulfill.ts](../../../server/src/campaignFulfill.ts) — payment intent create/sync; top-up path; `syncOwnerCampaignsPaymentStatus` for approved + pending.
- [server/src/campaignAnalyticsStore.ts](../../../server/src/campaignAnalyticsStore.ts) — `campaign_viewer_stats`; impression ingest + debit hook.
- [server/src/campaignVisibilityEconomics.ts](../../../server/src/campaignVisibilityEconomics.ts) — 100 NIM / 24 h default; `lunaDrainForVisibleMs`; prepaid API display.
- [server/src/rotationSetStore.ts](../../../server/src/rotationSetStore.ts), [rotationSetCompile.ts](../../../server/src/rotationSetCompile.ts), [rotationSetSync.ts](../../../server/src/rotationSetSync.ts) — admin carousel → in-world billboards.
- [server/src/rooms.ts](../../../server/src/rooms.ts) — WS handlers for impressions and link clicks.
- [server/src/index.ts](../../../server/src/index.ts) — `/api/advertise/*`, `/admin/campaign` APIs, guide route, startup balance repair.

### payment-intent-service

- [payment-intent-service/src/features/builtin.ts](../../../payment-intent-service/src/features/builtin.ts) — `nspace.billboard.slot`.
- [payment-intent-service/src/nim/rpc.ts](../../../payment-intent-service/src/nim/rpc.ts) — chain verification helpers.

### Deploy / ops

- Compose profile **`payment`** for payment-intent sidecar ([docker-compose.yml](../../../docker-compose.yml)).
- Env: `PAYMENT_INTENT_SERVICE_URL`, `PAYMENT_INTENT_API_SECRET`, `CAMPAIGN_NIM_PER_24H_VISIBLE`, optional Telegram for campaign approval ping.
- [docs/docker-deployment.md](../../../docs/docker-deployment.md) — payment sidecar notes (existing).
