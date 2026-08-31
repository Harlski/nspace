# Public patch notes — developers (`0.8.3`)

**Audience:** contributors and integrators — APIs, WS messages, module boundaries, notable refactors.  
**Depth:** summarized technical changelog; not a full file list (that stays in [../reasons.md](../reasons.md)).

---

- [NEW] Mosquito Tag achievement events: `tag_call_raised`, `tag_joined`, `mosquito_passed`, `mosquito_passed_clutch` (≤3s remaining), `tag_stung`, `tag_boost_pad`. Category `mosquito_tag` under Minigames. Evaluator: `server/src/mosquitoTag/achievements.ts`. Progress skipped when `MOSQUITO_TAG_ENABLED` is off.
- [NEW] Tag Room Lock: `participantRoomLocked` during countdown+playing. Server refuses `joinRoom` (reason `tag_round`), `enterPortal`, and client `leave`. Disconnect still drops the Participant. Participant Edge Markers reuse Ball Edge Marker geometry.
- [NEW] Tag Round Pay Zoom: `payTagTelescopeZoomActive` for Nimiq Pay Participants in that same window. `Game.setPayTagTelescopeZoom` reuses Telescope hold frustum (no achievement). Restore after.
- [FIX] Login streak credits a UTC calendar day on wallet WebSocket room enter (including cached JWT reconnect), not only `POST /api/auth/verify`. Same-day credits skip rewriting `login-streaks.json`. Guests are ignored.
- [CHANGE] `/advertise` Sign-in Gate: missing/expired session uses `SIGNED_IN_REQUIRED_MESSAGE` (`server/src/signedInRequired.ts`) instead of a generic load error.
- [CHANGE] Campaign creatives: create requires `/advertise/uploads/{uuid}.{ext}` from `POST /api/advertise/campaigns/upload-image`. Admin `PATCH /api/admin/advertise/campaigns/:id` accepts `imageUrl` and rebuilds rotation billboards. See ADR 0023.
