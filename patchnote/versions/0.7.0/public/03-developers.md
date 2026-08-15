# Public patch notes — developers (`0.7.0`)

**Audience:** contributors and integrators — APIs, WS messages, module boundaries, notable refactors.  
**Depth:** summarized technical changelog; not a full file list (that stays in [../reasons.md](../reasons.md)).

---

- [CHANGE] **`isMoveOrderBroadcastEnabled`** — on unless env is exactly `"0"` (was opt-in `"1"`). Wire types unchanged (`moveOrder` / `moveAbort`).
- [NEW] **Admin presence / freeze** — `{ type: "adminInvisible", enabled }`, `{ type: "adminFreeze", address, enabled }`; viewer-aware presence filter; admin-only `frozen` / `adminInvisible` cues on player state; `haltConnPath` zeroes leftover planar velocity on teleport/stop/no_path.
- [NEW] **Sale Displays** — place/bind/clear/move/delete / `setSaleDisplayWalk`; client try/buy panel, buy pad, walk path, shared `sendPaymentIntentCheckout` for Shop + Sale Display Unlock. ADR 0015. Shaper auto Preset gallery removed from welcome.
- [NEW] **Player Level / Daily Earn Allowance** — Level from AP; UTC-day spent store; `enqueueGameplayPayIntent` gate for mining / Free Play / maze (tutorial + admin feedback bypass). ADR 0014.
- [NEW] **Analytics Service** workspace — `GET /v1/overview`, `GET /v1/daily-stats-aggregate` (Bearer secret). Game thin-proxies; no in-process scan fallback. ADR 0016.
- [CHANGE] **Shop gate** — `SHOP_ENABLED !== "0"` and runtime `shopEnabled`; welcome + `shopAccess` WS refresh COMING SOON / Shaper; Temporarily unavailable cosmetics rows.
- [CHANGE] **Achievements** — meta Level 5/10/15; Worldcraft / Social / Play Space / Cosmetics / Exploration packs; silent catch-up for Level ladder and style unlocks. Production presets restored for nameplate frames and chat bubbles.
- [CHANGE] **payout-service** — pending summary / snapshot / wallet detail exclude Mining Restriction holds; admin snapshot splits payable vs held by recipient.
- [CHANGE] **@nimiq/core** — `2.2.2` → `2.20.0` (patch-package shim refreshed).
