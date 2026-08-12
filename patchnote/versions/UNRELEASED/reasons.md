# Reasons — UNRELEASED (patch-notes version)

**Patch-notes version:** `UNRELEASED` (working bucket). Before merging to `main`, run `npm run prepare-merge` so this folder is frozen under a semver that matches [package.json](../../../package.json) (see [patchnote/README.md](../../README.md)).

**Role:** Technical **reasons** attached to **this** patch-notes version — file-level and behavior-level inventory. Public-facing copy at other depths lives only under [public/](public/).

---

## Summary

Admin Invisibility (ops observation mode) for allowlisted admins. Player Level and Daily
Earn Allowance from Achievement Points (treasury throttle + nameplate status). Path Playback
(`MOVE_ORDER_BROADCAST`) on by default so click-to-walk self/remote motion uses accepted
path replay instead of snapshot micro-stutter; kill switch `=0`. **Sale Displays**: admin
Build Menu fixtures binding Published Catalog Entries; The Shaper auto Preset gallery
retired; try + buy via Cosmetic Unlock; kiosks outside The Shaper allowed.

---

## By area

### Repo / docs

- Glossary: **Admin Invisibility** / **Freeze** in `CONTEXT.md` (Freeze not shipped in this slice).
- Glossary: **Path Playback** in `CONTEXT.md` (Movement).
- Glossary: **Achievement Points**, **Player Level**, **Daily Earn Allowance**; ADR
  `docs/adr/0014-player-level-daily-earn-allowance.md`.
- Glossary / ADR: **Sale Display**, The Shaper curated floor; `docs/adr/0015-sale-displays.md`.
- `docs/process.md` / `docs/features-checklist.md`: `MOVE_ORDER_BROADCAST` default on
  (`=0` kill switch); Sale Displays + Shaper no longer auto Preset grid.
- `docs/build_menu.md`: Buildings → Sale Display (admin).
- Glossary: **Event Log** / **Analytics Service**; ADR
  `docs/adr/0016-analytics-service-sidecar.md`.
- `docs/process.md` / `docs/features-checklist.md` / `docs/docker-deployment.md` /
  `docs/live-service-implementation.md`: Analytics Service sidecar (port 3092).

### Client

- Admin overlay Watch tab: Admin Invisibility checkbox (`NSPACE_ADMIN_INVISIBLE`); WS connect `adminInvisible=1`; silent `playerJoined`/`playerLeft`; chat `suppressBubble`; translucent + Invisible nameplate cue for admin viewers.
- Fix room-change camera stickiness: snap look-at on first self sync after `setSelf`, clear prior-room `selfMoveOrder` on welcome so Hub/Commons transitions do not leave the camera on the previous room's coordinates.
- Fix mid-walk door/teleport stuck at ±0.22 from spawn: clear/adopt self soft-extrap velocity on room entry; allow Space/Enter on a door while a walk is still finishing; server `haltConnPath` zeroes leftover `vx`/`vz` when abandoning a path.
- Fix Admin Invisibility self-cue: owning admin receives toggle `stateDelta`; client `stateDelta` merge clears omitted `adminInvisible` so toggle OFF restores opacity without a room change.
- Nameplate shows `· Lv N` for wallets; Achievements Summary + profile show Player Level; mining toast when Daily Earn Allowance binds.
- Sale Displays: Build → Buildings → Sale Display place mode (Shaper carve-out); edit modal bind/clear/move/remove; slot-aware render; player try + buy panel (`saleDisplayPanels.ts`).

### Server

- `isMoveOrderBroadcastEnabled`: Path Playback dual-send **on unless** `MOVE_ORDER_BROADCAST=0`
  (was opt-in `=1` only).
- `adminPresence` policy helpers; viewer-aware presence filter on broadcast / welcome; `{ type: "adminInvisible", enabled }`; observation-only world-edit gate while invisible.
- `haltPathVelocity` / `haltConnPath`: teleport, stop, and no_path recovery clear planar velocity with the path so welcome/stateDelta cannot leave clients soft-extrapolating.
- `playerLevel` / `dailyEarnAllowance`: Level from AP, UTC-day spent store, `enqueueGameplayPayIntent` gate for mining / Free Play goals / maze; tutorial + admin feedback bypass; private at-cap feedback.
- Sale Displays store + wire projection; WS place/bind/clear/move/delete; `canPlaceSaleDisplay` Shaper carve-out; `cosmeticGalleryWelcomeExtras` no longer injects auto Preset gallery.
- `GET /api/analytics/overview` and daily-stats aggregate are thin proxies to the
  Analytics Service (503 if down). No in-process JSONL scan on the game event loop.
- `/admin/system` probes Analytics Service `GET /health`.

### payment-intent-service

- _(none in this change set)_

### analytics-service

- New workspace: Event Log scans for `/v1/overview` and `/v1/daily-stats-aggregate`.
  Bearer `ANALYTICS_SERVICE_API_SECRET`. Read-only `EVENT_LOG_DIR`.

### Deploy / ops

- **`MOVE_ORDER_BROADCAST`**: default on; set `=0` to kill-switch snapshot pose streaming.
- Compose service `analytics` (default): `127.0.0.1:3092`, volume `./data/events:ro`.
  `nspace` does not `depends_on` it. Env: `ANALYTICS_SERVICE_URL`,
  `ANALYTICS_SERVICE_API_SECRET`. `npm run dev` starts the sidecar.
