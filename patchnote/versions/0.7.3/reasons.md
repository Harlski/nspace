# Reasons — 0.7.3 (patch-notes version)

**Patch-notes version:** `0.7.3` (frozen via `npm run prepare-merge`).

**Role:** Technical **reasons** attached to **this** patch-notes version — file-level and behavior-level inventory. Public-facing copy at other depths lives only under [public/](public/).

---

## Summary

Mining Restriction hold is airtight, unauthenticated random-layout is gone, invisible admins can world-edit, mosquito is on the Emote Wheel (Twemoji only when the glyph is missing), Movement Watch shows Click Interval on successive Click Markers, and a diagnostic test records fixed-dt crawl under tick lag.

---

## By area

### Repo / docs

- Admin Invisibility and Mining Restriction glossary in `CONTEXT.md`; process / features-checklist / build / live-service docs for removed random-layout and invisibility world-edit.
- Click Interval glossary + ADR [0017](../../../docs/adr/0017-movement-watch-click-interval.md).

### Client

- Removed Random layout control from the admin overlay.
- Mosquito (🦟) on the Emote Wheel as native system text when the font has the glyph; Twemoji (`client/public/emoji/1f99f.svg`) only when `mosquitoNeedsTwemoji()` (canvas glyph probe).
- Lobby / `/patchnotes` `APP_DISPLAY_VERSION`: Vite watches root `package.json` and restarts so a `prepare-merge` bump is not stuck on the previous `vX.Y.Z` until a manual client restart.
- Profile flag chip: native hover `title` is the country name when a country is set; own empty chip stays "Pick your country"; own set chip `aria-label` is `{name}. Change your country.`
- Movement Watch Click Markers draw Click Interval (`2.43`) as a compact number plate stacked above the identity label.

### Server

- Removed `POST /api/admin/random-layout` and `adminRandomExtraFloorLayout`.
- `worldMutationsBlockedByInvisibility` no longer denies world-mutating intents (stream cinema still observation-only).
- `movementWatchClick.clickIntervalSec` stamped from the player's shown Click Marker stream; clock resets on leave / disconnect / idle Watch.
- Diagnostic only: `server/test/tickLagMoveSpeed.test.ts` shows fixed-dt `stepHumanAlongPath` crawls under late `setInterval` gaps while analytic `poseAlongPathAtTime` stays at `DEFAULT_PATH_MOVE_SPEED`.

### payout-service

- Mining Restriction list: fail-closed until a successful fetch (including after a later failed refresh); force-refresh before processor / bulk / flush / auto-bulk so already-queued block-claim jobs cannot send after a restriction is applied.

### payment-intent-service

- _(none in this change set)_

### Deploy / ops

- Unauthenticated `POST /api/admin/random-layout` is gone; remaining `/api/admin/*` JSON stays behind `requireSystemAdminWallet`.
