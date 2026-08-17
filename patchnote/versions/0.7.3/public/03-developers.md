# Public patch notes — developers (`0.7.3`)

**Audience:** contributors and integrators — APIs, WS messages, module boundaries, notable refactors.  
**Depth:** summarized technical changelog; not a full file list (that stays in [../reasons.md](../reasons.md)).

---

- [NEW] `ACTION_WHEEL_EMOTES` includes 🦟; Twemoji `/emoji/1f99f.svg` only when `mosquitoNeedsTwemoji()` (no system glyph).
- [FIX] Vite watches root `package.json` and restarts so lobby `APP_DISPLAY_VERSION` / `/patchnotes` follow `prepare-merge` without a stale `vX.Y.Z`.
- [NEW] `movementWatchClick.clickIntervalSec` (optional seconds, hundredths) on shown Click Markers after the first; omitted after leave / disconnect / idle Watch. Client draws a compact plate. ADR [0017](../../../docs/adr/0017-movement-watch-click-interval.md).
- [CHANGE] `worldMutationsBlockedByInvisibility` always returns false; `connBlocksWorldEdit` still blocks stream cinema.
- [CHANGE] Payout Service mining-restriction gate fail-closes until the first successful list fetch; `refreshMiningBannedWallets(true)` runs before processor / bulk / flush / auto-bulk.
- [CHANGE] Profile flag chip: native `title` is the country name when set; own empty chip stays "Pick your country"; own set chip `aria-label` is `{name}. Change your country.`
- [SEC] `POST /api/admin/random-layout` and `adminRandomExtraFloorLayout` are gone.
- `server/test/tickLagMoveSpeed.test.ts` records that fixed-dt room ticks crawl under event-loop lag while analytic `moveOrder` stays at MOVE_SPEED (diagnostic only; no behavior change).
