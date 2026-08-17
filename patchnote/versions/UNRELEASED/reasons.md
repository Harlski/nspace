# Reasons — UNRELEASED (patch-notes version)

**Patch-notes version:** `UNRELEASED` (working bucket). Before merging to `main`, run `npm run prepare-merge` so this folder is frozen under a semver that matches [package.json](../../../package.json) (see [patchnote/README.md](../../README.md)).

**Role:** Technical **reasons** attached to **this** patch-notes version — file-level and behavior-level inventory. Public-facing copy at other depths lives only under [public/](public/).

---

## Summary

Mining Restriction hold is airtight, unauthenticated random-layout is gone, invisible admins can world-edit, mosquito is visible on Windows, and Movement Watch shows Click Interval on successive Click Markers.

---

## By area

### Repo / docs

- Admin Invisibility and Mining Restriction glossary in `CONTEXT.md`; process / features-checklist / build / live-service docs for removed random-layout and invisibility world-edit.
- Click Interval glossary + ADR [0017](../../../docs/adr/0017-movement-watch-click-interval.md).

### Client

- Removed Random layout control from the admin overlay.
- Mosquito (🦟) on the Emote Wheel; Twemoji image in chat, bubbles, and the wheel (`client/public/emoji/1f99f.svg`).
- Profile flag chip: native hover `title` is the country name when a country is set; own empty chip stays "Pick your country"; own set chip `aria-label` is `{name}. Change your country.`
- Movement Watch Click Markers draw Click Interval (`2.43`) stacked above the identity label.

### Server

- Removed `POST /api/admin/random-layout` and `adminRandomExtraFloorLayout`.
- `worldMutationsBlockedByInvisibility` no longer denies world-mutating intents (stream cinema still observation-only).
- `movementWatchClick.clickIntervalSec` stamped from the player's shown Click Marker stream; clock resets on leave / disconnect / idle Watch.

### payout-service

- Mining Restriction list: fail-closed until a successful fetch (including after a later failed refresh); force-refresh before processor / bulk / flush / auto-bulk so already-queued block-claim jobs cannot send after a restriction is applied.

### payment-intent-service

- _(none in this change set)_

### Deploy / ops

- Unauthenticated `POST /api/admin/random-layout` is gone; remaining `/api/admin/*` JSON stays behind `requireSystemAdminWallet`.
