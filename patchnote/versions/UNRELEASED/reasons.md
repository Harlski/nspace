# Reasons — UNRELEASED (patch-notes version)

**Patch-notes version:** `UNRELEASED` (working bucket). Before merging to `main`, run `npm run prepare-merge` so this folder is frozen under a semver that matches [package.json](../../../package.json) (see [patchnote/README.md](../../README.md)).

**Role:** Technical **reasons** attached to **this** patch-notes version — file-level and behavior-level inventory. Public-facing copy at other depths lives only under [public/](public/).

---

## Summary

Player profiles now enrich wallet identity with verified NimConnect handles while
keeping Nimiq Space usernames and multiplayer contracts unchanged.

---

## By area

### Repo / docs

- _(none yet)_

### Client

- Added exact client dependency `@nimconnect/profile-client@0.5.0`.
- Added `client/src/ui/nimconnectProfileIdentity.ts`: address-to-handle lookup,
  safe handle validation, stale-response protection, self-profile claim link,
  and silent fallback when the optional resolver is unavailable.
- Mounted the compact `@handle` link under the existing Space display name in
  `client/src/ui/hud.ts`; no `PlayerState` or WebSocket message shape changed.
- Added focused happy-dom coverage in
  `client/src/ui/nimconnectProfileIdentity.test.ts`.

### Server

- _(none in this change set)_

### payment-intent-service

- _(none in this change set)_

### Deploy / ops

- _(none in this change set)_
