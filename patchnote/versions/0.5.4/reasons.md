# Reasons — 0.5.4 (patch-notes version)

**Patch-notes version:** `0.5.4` (frozen via `npm run prepare-merge`).

**Role:** Technical **reasons** attached to **this** patch-notes version — file-level and behavior-level inventory. Public-facing copy at other depths lives only under [public/](public/).

---

## Summary

_Add a one-line roll-up here when the buffer gets long._

---

## By area

### Repo / docs

- _(none yet)_

### Client

- _(none in this change set)_

### Server

- **Admin credit now rescues unfunded advertise campaigns.** `grantCampaignAdminCredit` ([server/src/campaignStore.ts](../../../server/src/campaignStore.ts)) accepts `draft`/`pending_payment` in addition to the existing funded statuses. Crediting an unfunded campaign treats the credit as the funding event: it sets `balance_luna`, moves the campaign to `pending_approval`, adopts the synthetic `admin-credit:<uuid>` as `tx_hash` (so `approveCampaign`'s `campaign_missing_tx` guard passes), clears any stale `intent_id`, and records a funding ledger row. Funded campaigns keep their original on-chain `tx_hash` and lifecycle position (unchanged behavior). This is the manual rescue for a real payment that landed without the intent memo and therefore could not be auto-verified. The `/admin/campaign` credit box ([server/src/adminCampaignPage.ts](../../../server/src/adminCampaignPage.ts)) is now shown for unfunded campaigns with rescue-specific copy ("Credit and queue for approval") and a hint. New tests: [server/test/campaignAdminCredit.test.ts](../../../server/test/campaignAdminCredit.test.ts). No API surface change (`POST /api/admin/advertise/campaigns/:id/credit`).
- **Advertise checkout now refuses to send without the intent memo.** `buildCheckoutOpts` (Hub) and `buildNimiqPayTx` (Nimiq Pay) in [server/src/advertisePage.ts](../../../server/src/advertisePage.ts) previously attached the memo only `if (memo)`; a missing memo would silently send an unverifiable payment. Both now `throw "missing_memo"` when the memo is empty (surfaced as a clear preflight error, no NIM sent). The Nimiq Pay send-retry loop also falls through to the alternate (hex-encoded) memo variant on data/format errors — not only "invalid amount" — while still bailing on user aborts, so a memo-encoding rejection can recover instead of dropping the message.

### payment-intent-service

- _(none in this change set)_

### Deploy / ops

- _(none in this change set)_
