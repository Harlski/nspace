# Reasons — UNRELEASED (patch-notes version)

**Patch-notes version:** `UNRELEASED` (working bucket). Before merging to `main`, run `npm run prepare-merge` so this folder is frozen under a semver that matches [package.json](../../../package.json) (see [patchnote/README.md](../../README.md)).

**Role:** Technical **reasons** attached to **this** patch-notes version — file-level and behavior-level inventory. Public-facing copy at other depths lives only under [public/](public/).

---

## Summary

Mosquito Tag achievements (Ringleader, Count Me In, Hot Potato, Saved by the Bell, Got Bit, Nectar), green Pass flash, Stung identicon on the result overlay. Login streak day = wallet presence that UTC calendar day.

---

## By area

### Repo / docs

- Login streak day = wallet presence that UTC calendar day (WS enter or Hub/Pay verify), not verify-only. See [docs/THE-LARGER-SYSTEM.md](../../../docs/THE-LARGER-SYSTEM.md) and [docs/reasons/reason_264819.md](../../../docs/reasons/reason_264819.md).

### Client

- Green screen flash when you Pass the Mosquito (`tagScreenFlash` / `.hud-tag-holder-flash--good`). Result overlay shows the Stung player's identicon instead of a Stung label for everyone.

### Server

- [`server/src/loginStreakStore.ts`](../../../server/src/loginStreakStore.ts): same-UTC-day credits skip a ledger rewrite; optional `at` for tests; guests ignored.
- [`server/src/rooms.ts`](../../../server/src/rooms.ts) `onPlayerEnteredRoom`: `recordLoginStreakForWallet` before achievement evaluation so a cached JWT reconnect still counts.
- [`server/test/loginStreakStore.test.ts`](../../../server/test/loginStreakStore.test.ts): consecutive days (the 27→28→29 reconnect case), same-day no rewrite, gap reset, guests.
- Mosquito Tag achievements: `evaluateMosquitoTagAchievementEvents` on Tag state deltas; events `tag_call_raised` / `tag_joined` / `mosquito_passed` / `mosquito_passed_clutch` / `tag_stung` / `tag_boost_pad`. Progress paused when `MOSQUITO_TAG_ENABLED` is off.

### payment-intent-service

- _(none in this change set)_

### Deploy / ops

- _(none in this change set)_
