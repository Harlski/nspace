# Public patch notes — developers (`UNRELEASED`)

**Audience:** contributors and integrators — APIs, WS messages, module boundaries, notable refactors.  
**Depth:** summarized technical changelog; not a full file list (that stays in [../reasons.md](../reasons.md)).

---

_(Draft — not published.)_

- [CHANGE] **`@nimiq/core` → 2.7.2** across root `overrides`, `server`, `payout-service`, and `payment-intent-service`. Required after the mainnet hard fork removed ZKP-based light sync; pico sync is what current seeds speak. Dropped `patches/@nimiq+core+2.2.2.patch`.
