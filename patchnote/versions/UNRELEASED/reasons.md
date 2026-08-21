# Reasons — UNRELEASED (patch-notes version)

**Patch-notes version:** `UNRELEASED` (working bucket). Before merging to `main`, run `npm run prepare-merge` so this folder is frozen under a semver that matches [package.json](../../../package.json) (see [patchnote/README.md](../../README.md)).

**Role:** Technical **reasons** attached to **this** patch-notes version — file-level and behavior-level inventory. Public-facing copy at other depths lives only under [public/](public/).

---

## Summary

Ambient Cast on the Main Menu: lean Face Token snapshot API + Soft Density walkers.

---

## By area

### Repo / docs

- Glossary: **Main Menu**, **Ambient Cast**, **Face Token**, **Soft Density** in [CONTEXT.md](../../../CONTEXT.md)
- Spec: [.scratch/ambient-main-menu-cast/PRD.md](../../../.scratch/ambient-main-menu-cast/PRD.md)

### Client

- [client/src/ambientCast/](../../../client/src/ambientCast/) — Face Token decode/render, Soft Density, canvas Ambient Cast mounted from [mainMenu.ts](../../../client/src/ui/mainMenu.ts)
- ~5 min snapshot refresh; ~8–12 Soft Density; pointer-events none

### Server

- [server/src/ambientCast/](../../../server/src/ambientCast/) — Face Token encode from identicon features; eligibility from Event Log `session_start` (exclude Play Spaces)
- Public **`GET /api/ambient-cast`** → `{ day, refreshedAt, faces: [{ token }] }` (no wallet IDs)
- [eventLog.ts](../../../server/src/eventLog.ts) `listEventRecordsForUtcDay`

### payment-intent-service

- _(none in this change set)_

### Deploy / ops

- _(none in this change set)_
