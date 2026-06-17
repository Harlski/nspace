# Billboard advertising — user guide

**Live page:** [/advertise/how-it-works](http://127.0.0.1:3001/advertise/how-it-works) (same route on production API host)

**Dashboard:** [/advertise](http://127.0.0.1:3001/advertise) — wallet sign-in required.

This guide explains how a paid campaign becomes an in-game billboard advert. For operator deploy and API detail, see [features-checklist.md](features-checklist.md), [process.md](process.md) (campaign audience stats), and [docker-deployment.md](docker-deployment.md) (payment-intent sidecar).

---

## Quick path (7 steps)

1. **Sign in** at `/advertise` with your Nimiq wallet.
2. **Create** a campaign: project name, HTTPS project URL, billboard image (upload or URL), on-screen duration (10 / 30 / 45 s).
3. **Fund** with NIM via **Pay with wallet** (any amount; default **400 NIM ≈ 24 h** on-screen at full audience).
4. **Wait for approval** — status **Pending approval** until operators review.
5. **Go live on billboards** — after approval, your advert is placed on billboards around the game. Until then: **Approved · Not Live**.
6. **Players see your advert** within **14 blocks**; **Visit** opens your project URL. Balance **drains only** for verified on-screen time (tab visible, not AFK).
7. **Add funds** anytime on approved/live campaigns to extend prepaid time without re-approval.

---

## Prepaid visibility (how billing works)

| Concept | Behavior |
|--------|----------|
| **Funded** | Sum of on-chain payments recorded in transaction history |
| **Remaining** | Prepaid balance minus visibility drain |
| **Time left** | `remaining NIM ÷ on-screen rate` — not a fixed calendar expiry |
| **Drain** | While live on billboards: `rate × seconds on screen` for qualifying viewers |
| **Qualifying viewer** | Within 7 floor tiles, game tab visible, not AFK (2 min), not in wallet-send flow |
| **Zero balance** | Campaign expires and is removed from billboards |

Dwell (10 / 30 / 45 s) is free to choose; longer slides consume more balance each time they are shown while players watch.

---

## Dashboard tabs

### New

Create a draft campaign. Edit name, URL, image, and dwell until you fund.

### Existing

- Campaign tiles with status: **Draft**, **Pending payment**, **Pending approval**, **Approved**, **Live** / **Not Live**, **Expired**
- **Prepaid visibility** card — time left, NIM remaining, funded total, progress bar
- **Audience** — unique viewers, total/avg on-screen time, link visits, last seen
- **On-screen duration** — editable after funding
- **Fund** / **Add funds** / **Retry payment**
- **Transaction history** — each payment with [nimiq.watch](https://nimiq.watch) link

---

## Admin side (what happens after you pay)

Operators use **`/admin/campaign`**:

1. **Pending approvals** — approve or reject funded campaigns
2. **Approved campaigns** — view balance, audience stats, Live / Not live
3. **Rotations** — build carousel sets and assign approved campaigns to slides
4. In-game **Campaign** build tab — place rotation billboards in rooms

Telegram may notify operators when a campaign reaches pending approval (optional env).

---

## Technical references

| Area | Location |
|------|----------|
| Advertiser UI | [server/src/advertisePage.ts](../server/src/advertisePage.ts) |
| How-it-works page | [server/src/advertiseGuidePage.ts](../server/src/advertiseGuidePage.ts) |
| Campaign store / balance | [server/src/campaignStore.ts](../server/src/campaignStore.ts) |
| Payment + approval flow | [server/src/campaignFulfill.ts](../server/src/campaignFulfill.ts) |
| Visibility economics | [server/src/campaignVisibilityEconomics.ts](../server/src/campaignVisibilityEconomics.ts) |
| In-game impressions | [client/src/game/campaignBillboardVisibility.ts](../client/src/game/campaignBillboardVisibility.ts) |
| Admin UI | [server/src/adminCampaignPage.ts](../server/src/adminCampaignPage.ts) |
