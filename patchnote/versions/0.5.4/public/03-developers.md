# Public patch notes — developers (`0.5.4`)

**Audience:** contributors and integrators — APIs, WS messages, module boundaries, notable refactors.  
**Depth:** summarized technical changelog; not a full file list (that stays in [../reasons.md](../reasons.md)).

---

- **Advertise checkout guarantees the intent memo is attached.** `buildCheckoutOpts` (Hub `extraData`) and `buildNimiqPayTx` (Nimiq Pay `tx.data`) now throw `missing_memo` instead of silently sending an unverifiable payment when the memo is empty (surfaced as a clean preflight error, no NIM sent). The Nimiq Pay send-retry loop also falls through to the hex-encoded memo variant on data/format errors, not only "invalid amount" errors, while still bailing on user aborts.
- **`POST /api/admin/advertise/campaigns/:id/credit` now accepts unfunded campaigns.** `draft` / `pending_payment` campaigns can be credited: the credit becomes the funding event, moving them to `pending_approval` with a synthetic `admin-credit:<uuid>` `tx_hash` so they can be approved like any funded advert. Funded-campaign crediting (top-up, `expired`→`approved`) is unchanged. No API surface change.
