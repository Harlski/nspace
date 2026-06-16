# Public patch notes — developers (`0.3.27`)

**Audience:** contributors and integrators — APIs, WS messages, module boundaries, notable refactors.  
**Depth:** summarized technical changelog; not a full file list (that stays in [../reasons.md](../reasons.md)).

---

## Advertise portal & campaigns

- **[NEW]** **`GET/POST /api/advertise/campaigns`**, **`PUT …/:id`**, **`POST …/:id/intent`**, **`POST …/:id/sync`**, **`GET …/:id/transactions`**, **`GET /api/advertise/meta`**, **`GET /api/advertise/estimate`**, image upload **`POST /api/advertise/campaigns/upload-image`** — [server/src/index.ts](../../../server/src/index.ts), [server/src/campaignStore.ts](../../../server/src/campaignStore.ts).
- **[NEW]** User guide page [server/src/advertiseGuidePage.ts](../../../server/src/advertiseGuidePage.ts) at **`/advertise/how-it-works`**; repo doc [docs/advertise-guide.md](../../../docs/advertise-guide.md).
- **[NEW]** Campaign lifecycle: `draft` → `pending_payment` → `pending_approval` → `approved` → `expired`; top-up on `approved` via **`setCampaignTopUpPayment`** / **`applyCampaignTopUpPayment`**.
- **[NEW]** **`campaign_transactions`** ledger; prepaid display via **`campaignPrepaidDisplayForApi`** ([server/src/campaignVisibilityEconomics.ts](../../../server/src/campaignVisibilityEconomics.ts)).
- **[FIX]** Clear **`intent_id`** on first payment confirm and admin approve; idempotent top-up by **`tx_hash`**; **`repairInflatedCampaignBalances()`** on startup.

## In-game audience & billing

- **[NEW]** Client WS **`campaignImpression`** `{ items: [{ campaignId, visibleMs }] }` batched ~5 s; **`campaignLinkClick`** on Visit — [client/src/game/campaignBillboardVisibility.ts](../../../client/src/game/campaignBillboardVisibility.ts), [server/src/rooms.ts](../../../server/src/rooms.ts).
- **[NEW]** SQLite **`campaign_viewer_stats`**; **`debitCampaignVisibilityLuna`** per impression batch — [server/src/campaignAnalyticsStore.ts](../../../server/src/campaignAnalyticsStore.ts).
- **[NEW]** Proximity **7 blocks**; excludes `document.hidden`, 2 min AFK, **`nimSendIntent`** wallet-send flow.
- **[CHANGE]** Removed dev **Test Radio mini-app** HUD button (`client/src/main.ts`, `client/src/ui/hud.ts`).

## Admin & rotations

- **[NEW]** **`/api/admin/advertise/campaigns/*`** approve/reject/overview; rotation sets [server/src/rotationSetStore.ts](../../../server/src/rotationSetStore.ts), compile/sync [server/src/rotationSetCompile.ts](../../../server/src/rotationSetCompile.ts).
- **[NEW]** Admin UI [server/src/adminCampaignPage.ts](../../../server/src/adminCampaignPage.ts) — prepaid + analytics columns, 3D billboard preview.

## Payment intents

- **[NEW]** Feature kind **`nspace.billboard.slot`** in payment-intent-service [payment-intent-service/src/features/builtin.ts](../../../payment-intent-service/src/features/builtin.ts); game server proxy [server/src/campaignFulfill.ts](../../../server/src/campaignFulfill.ts).
