# Public patch notes — developers (`0.3.11`)

**Audience:** contributors and integrators — APIs, WS messages, module boundaries, notable refactors.  
**Depth:** summarized technical changelog; not a full file list (that stays in [../reasons.md](../reasons.md)).

---

- [CHANGE] **`POST /api/auth/verify`:** Optional **`acceptedTermsPrivacyVersion`** (string, must match server docs version) when the client is acknowledging Terms/Privacy for this login. Error **`terms_privacy_ack_required`** (and legacy **`legal_consent_required`**) when the server requires acknowledgement; clients should retry with the version after user consent.
- [CHANGE] **`GET /api/player-profile/:address`:** Response **`rooms[]`** (≤3) now includes **`playerCount`** (live non-NPC clients in that room). Entries are sorted **descending by `playerCount`**, then display name, then id. Public callers still see public rooms only; bearer matching the profile wallet (or an admin) also receives private owned rooms. Client also sorts `rooms` by `playerCount` so older servers without the new field degrade gracefully.
- [CHANGE] **Export:** **`getLiveRealPlayerCountInRoom`** from `server/src/rooms.ts` — used when assembling profile `rooms[]` alongside `listRoomsOwnedBy` (`server/src/roomRegistry.ts`).
- [CHANGE] **Static/legal:** `tacs.html` / `privacy.html` and Express (or equivalent) wiring for **`/tacs`** / **`/privacy`**; admin/analytics/payouts HTML flows align with the same verify payload where signing is used.
- [CHANGE] **`SKIP_BLOCK_PICK_AND_BOUNDS` widened:** the `userData` flag (and matching no-op `raycast`) now applies to **any** decorative child of an authoritative `THREE.Group` — placed-block VFX as before, plus avatar nameplate sprites. Reuse this convention for any new chrome you attach to an avatar / placed obstacle so it does not steal block, floor, or avatar picks.
- [FIX] **Chat self-defends its colour:** `.chat-log` / `.chat-line` now declare `color` locally instead of inheriting from `body`, so the chat panel stays readable regardless of where the Nimiq stylesheet lands in the cascade.
