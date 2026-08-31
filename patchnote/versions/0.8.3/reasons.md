# Reasons — 0.8.3 (patch-notes version)

**Patch-notes version:** `0.8.3` (frozen via `npm run prepare-merge`).

**Role:** Technical **reasons** attached to **this** patch-notes version — file-level and behavior-level inventory. Public-facing copy at other depths lives only under [public/](public/).

---

## Summary

Mosquito Tag achievements (Ringleader, Count Me In, Hot Potato, Saved by the Bell, Got Bit, Nectar), green Pass flash, Stung identicon on the result overlay. Login streak day = wallet presence that UTC calendar day. Tag Room Lock (no Teleporter / room change during Countdown and Tag Round). Participant Edge Markers for off-screen Participants. Tag Round Pay Zoom (Nimiq Pay Participants get Telescope range during Countdown and Tag Round). Advertise Sign-in Gate and Campaign Creative upload-only (admins can replace the image on a campaign).

---

## By area

### Repo / docs

- Login streak day = wallet presence that UTC calendar day (WS enter or Hub/Pay verify), not verify-only. See [docs/THE-LARGER-SYSTEM.md](../../../docs/THE-LARGER-SYSTEM.md) and [docs/reasons/reason_264819.md](../../../docs/reasons/reason_264819.md).
- Advertise glossary: **Campaign**, **Project URL**, **Campaign Creative**, **Sign-in Gate** in [CONTEXT.md](../../../CONTEXT.md). ADR [0023](../../../docs/adr/0023-campaign-creatives-are-uploads.md). THE-LARGER-SYSTEM login-gated page principle + campaign creatives decision + [reason_847615](../../../docs/reasons/reason_847615.md). [docs/advertise-guide.md](../../../docs/advertise-guide.md) and [docs/features-checklist.md](../../../docs/features-checklist.md) advertise/admin bullets.

### Client

- Green screen flash when you Pass the Mosquito (`tagScreenFlash` / `.hud-tag-holder-flash--good`). Result overlay shows the Stung player's identicon beside `{name} got bit by the mosquito`.
- Tag Room Lock HUD: hide Enter on Teleporter/door, hide Player Menu Rooms / Return to Hub, disable Action Wheel room-change leaves. `joinRoomFailed` reason `tag_round`.
- Participant Edge Markers (`client/src/mosquitoTag/edgeMarkers.ts`): Ball Edge Marker placement; Holder amber, other Participants green.
- Tag Round Pay Zoom: `payTagTelescopeZoomActive` (Nimiq Pay + Tag Room Lock window); `Game.setPayTagTelescopeZoom` reuses Telescope hold frustum without the achievement; restore after.

### Server

- [`server/src/loginStreakStore.ts`](../../../server/src/loginStreakStore.ts): same-UTC-day credits skip a ledger rewrite; optional `at` for tests; guests ignored.
- [`server/src/rooms.ts`](../../../server/src/rooms.ts) `onPlayerEnteredRoom`: `recordLoginStreakForWallet` before achievement evaluation so a cached JWT reconnect still counts.
- [`server/test/loginStreakStore.test.ts`](../../../server/test/loginStreakStore.test.ts): consecutive days (the 27→28→29 reconnect case), same-day no rewrite, gap reset, guests.
- Mosquito Tag achievements: `evaluateMosquitoTagAchievementEvents` on Tag state deltas; events `tag_call_raised` / `tag_joined` / `mosquito_passed` / `mosquito_passed_clutch` / `tag_stung` / `tag_boost_pad`. Progress paused when `MOSQUITO_TAG_ENABLED` is off.
- Tag Room Lock: `participantRoomLocked`; `joinRoom` / `enterPortal` / client `leave` refused during countdown+playing; disconnect still applies engine leave. `joinRoomFailed.reason` `tag_round`.
- **Advertise Sign-in Gate:** `/advertise` (dashboard load, transactions, create/save/duration, image upload) shows "You must be signed in to perform this action." on missing/expired session instead of "Could not load campaigns." (`server/src/signedInRequired.ts`, `server/src/advertisePage.ts`).
- **Campaign Creative upload-only:** owner create rejects remote image URLs; only `/advertise/uploads/{uuid}.{ext}` from `POST /api/advertise/campaigns/upload-image`. Draft update may keep a legacy remote creative until replaced. Admin `PATCH /api/admin/advertise/campaigns/:id` accepts `imageUrl` the same way and rebuilds live rotation billboards. (`server/src/campaignImageUpload.ts`, `server/src/campaignStore.ts`, `server/src/campaignFulfill.ts`, `server/src/adminCampaignPage.ts`). See [adr/0023-campaign-creatives-are-uploads.md](../../../docs/adr/0023-campaign-creatives-are-uploads.md).

### payment-intent-service

- _(none in this change set)_

### Deploy / ops

- _(none in this change set)_
