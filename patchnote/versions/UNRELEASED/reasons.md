# Reasons — UNRELEASED (patch-notes version)

**Patch-notes version:** `UNRELEASED` (working bucket). Before merging to `main`, run `npm run prepare-merge` so this folder is frozen under a semver that matches [package.json](../../../package.json) (see [patchnote/README.md](../../README.md)).

**Role:** Technical **reasons** attached to **this** patch-notes version — file-level and behavior-level inventory. Public-facing copy at other depths lives only under [public/](public/).

---

## Summary

Admin Invisibility (ops observation mode) for allowlisted admins. Nested Other Player
Menu plus Admin Freeze (silent locomotion hitch). Player Level and Daily Earn Allowance
from Achievement Points (treasury throttle + nameplate status). Path Playback
(`MOVE_ORDER_BROADCAST`) on by default so click-to-walk self/remote motion uses accepted
path replay instead of snapshot micro-stutter; kill switch `=0`. **Sale Displays**: admin
Build Menu fixtures binding Published Catalog Entries; The Shaper auto Preset gallery
retired; try + buy via Cosmetic Unlock; kiosks outside The Shaper allowed.

---

## By area

### Repo / docs

- Glossary: **Admin Invisibility** / **Freeze** / **Other Player Menu** in `CONTEXT.md`.
- Glossary: **Path Playback** in `CONTEXT.md` (Movement).
- Glossary: **Achievement Points**, **Player Level**, **Daily Earn Allowance**; ADR
  `docs/adr/0014-player-level-daily-earn-allowance.md`.
- Glossary / ADR: **Sale Display**, The Shaper curated floor; `docs/adr/0015-sale-displays.md`.
- `docs/process.md` / `docs/features-checklist.md`: `MOVE_ORDER_BROADCAST` default on
  (`=0` kill switch); Sale Displays + Shaper no longer auto Preset grid.
- Glossary: **Event Log** / **Analytics Service**; ADR
  `docs/adr/0016-analytics-service-sidecar.md`.
- `docs/process.md` / `docs/features-checklist.md` / `docs/docker-deployment.md` /
  `docs/live-service-implementation.md`: Analytics Service sidecar (port 3092).

### Client

- Admin overlay Watch tab: Admin Invisibility checkbox (`NSPACE_ADMIN_INVISIBLE`); WS connect `adminInvisible=1`; silent `playerJoined`/`playerLeft`; chat `suppressBubble`; translucent + Invisible nameplate cue for admin viewers.
- Nested Other Player Menu (`otherPlayerMenuModel`): View {username} drill-in, Accept 1v1 root row, View Profile / Whisper, More → Administrative for admins; Copy Wallet removed from this menu.
- Admin Freeze cue: `player.frozen` → nameplate `· Frozen` for admin viewers; `sendAdminFreeze`.
- Fix room-change camera stickiness: snap look-at on first self sync after `setSelf`, clear prior-room `selfMoveOrder` on welcome so Hub/Commons transitions do not leave the camera on the previous room's coordinates.
- Fix mid-walk door/teleport stuck at ±0.22 from spawn: clear/adopt self soft-extrap velocity on room entry; allow Space/Enter on a door while a walk is still finishing; server `haltConnPath` zeroes leftover `vx`/`vz` when abandoning a path.
- Fix Admin Invisibility self-cue: owning admin receives toggle `stateDelta`; client `stateDelta` merge clears omitted `adminInvisible` so toggle OFF restores opacity without a room change.
- Nameplate shows `· Lv N` for wallets; Achievements Summary + profile show Player Level; mining toast when Daily Earn Allowance binds.
- Sale Displays: Build → Buildings → Sale Display place mode (Shaper carve-out); edit modal bind/clear/move/remove; slot-aware render; player try + buy panel (`saleDisplayPanels.ts`).
- Sale Display foot plates hidden outside Build mode (`syncSaleDisplayFootVisibility`).
- Sale Display product labels smaller + camera-synced; green buy pad on +Z — stand for teleporter-style **Buy** intent pill (also click-to-buy while on pad).
- Sale Display Buy + Wardrobe Shop: WebGL self preview (identicon + loadout) with purchase Slot overridden.
- Sale Display mannequin walk: per-display `walkEnabled` / `walkTiles` (admin Set path); foot + buy pad stay on anchor.
- Nameplate Slot presets restored: `nameplate-frame-simple` / `nameplate-frame-neon` (+ border colors for equip / Sale Display mannequins).
- Cosmetic Unlock: Wardrobe Shop + Sale Display Buy auto-open Pay/Hub via shared `sendPaymentIntentCheckout` (Unlock Pad path); error-only on cancel (no memo clipboard).
- Chat bubble Slot presets restored: `bubble-rounded-pastel` / `bubble-sharp-dark` (+ wardrobe / chat CSS classes).
- Shop open by default (`SHOP_ENABLED` / `VITE_SHOP_ENABLED`; set `=0` to close).

### Server

- `isMoveOrderBroadcastEnabled`: Path Playback dual-send **on unless** `MOVE_ORDER_BROADCAST=0`
  (was opt-in `=1` only).
- `adminPresence` policy helpers; viewer-aware presence filter on broadcast / welcome; `{ type: "adminInvisible", enabled }`; observation-only world-edit gate while invisible.
- `adminFreeze` policy + `{ type: "adminFreeze", address, enabled }`; path clear + silent `moveTo` reject; admin-only `frozen` cue; clear on Unfreeze / leave / disconnect; works while actor is Admin Invisible.
- `haltPathVelocity` / `haltConnPath`: teleport, stop, and no_path recovery clear planar velocity with the path so welcome/stateDelta cannot leave clients soft-extrapolating.
- `playerLevel` / `dailyEarnAllowance`: Level from AP, UTC-day spent store, `enqueueGameplayPayIntent` gate for mining / Free Play goals / maze; tutorial + admin feedback bypass; private at-cap feedback.
- Sale Displays: Build → Buildings placeable (admin); full admin Build in The Shaper; WS place/bind/clear/move/delete/`setSaleDisplayWalk`; auto Preset gallery retired from welcome.
- Production presets: restore `nameplate-frame-simple` / `nameplate-frame-neon` / `bubble-rounded-pastel` / `bubble-sharp-dark` for catalog authoring and shop bind.
- Shop open by default (`SHOP_ENABLED` / `VITE_SHOP_ENABLED`; close with `=0`).
- `/admin` Quick payout: Payable vs Mining Restriction tabs (`pendingByRecipientMiningHeld`, `miningHeldPendingTotal`); `/payouts` omits mining-held jobs from public/wallet pending display.
- `GET /api/analytics/overview` and daily-stats aggregate are thin proxies to the
  Analytics Service (503 if down). No in-process JSONL scan on the game event loop.
- `/admin/system` probes Analytics Service `GET /health`.

### payment-intent-service

- _(none in this change set)_

### payout-service

- Pending summary / snapshot / wallet detail exclude jobs held by Mining Restriction; admin panel snapshot splits payable vs held by recipient.

### analytics-service

- New workspace: Event Log scans for `/v1/overview` and `/v1/daily-stats-aggregate`.
  Bearer `ANALYTICS_SERVICE_API_SECRET`. Read-only `EVENT_LOG_DIR`.

### Deploy / ops

- Compose service `analytics` (default): `127.0.0.1:3092`, volume `./data/events:ro`.
  `nspace` does not `depends_on` it. Env: `ANALYTICS_SERVICE_URL`,
  `ANALYTICS_SERVICE_API_SECRET`. `npm run dev` starts the sidecar.

### Achievements wave (Level, cosmetics, rooms)

- Shop open = `SHOP_ENABLED !== "0"` **and** admin runtime `shopEnabled` (default true);
  `/admin/settings` checkbox; welcome + `shopAccess` WS refresh COMING SOON / Shaper.
- **Temporarily unavailable** for Shop/Shaper-dependent Cosmetics rows; Progress Overview
  omits incomplete unavailable; Football pause unchanged.
- Meta Level 5/10/15 (`player_level`); reward SKUs `ach-nameplate-frame-*` /
  `ach-bubble-*` (reuse presets).
- Worldcraft: Open House, Room to Room, Two Keys, Extra Hands, Company/Housewarming
  (shared `public-room-visitor:` prefix); Social Between Us / Take a Look; Play Space
  Private Room / Come On In; Cosmetics six-row pack; Exploration Knock Knock / Toll Crossed.
- Silent catch-up: Level ladder, owned-room state, Framed/Caption/Paid in Style.
