# Public patch notes — developers (`UNRELEASED`)

**Audience:** contributors and integrators — APIs, WS messages, module boundaries, notable refactors.  
**Depth:** summarized technical changelog; not a full file list (that stays in [../reasons.md](../reasons.md)).

---

- [CHANGE] `worldMutationsBlockedByInvisibility` always returns false; `connBlocksWorldEdit` still blocks stream cinema.
- [SEC] `POST /api/admin/random-layout` and `adminRandomExtraFloorLayout` are gone.
- [CHANGE] Payout Service mining-restriction gate fail-closes until the first successful list fetch; `refreshMiningBannedWallets(true)` runs before processor / bulk / flush / auto-bulk.
- [NEW] `ACTION_WHEEL_EMOTES` includes 🦟; `appendTextWithFlags` / chat bubbles render it via `/emoji/1f99f.svg`.
- [NEW] `movementWatchClick.clickIntervalSec` (optional seconds, hundredths) on shown Click Markers after the first; omitted after leave / disconnect / idle Watch. ADR [0017](../../../docs/adr/0017-movement-watch-click-interval.md).
