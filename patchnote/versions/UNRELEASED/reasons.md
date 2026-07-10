# Reasons — UNRELEASED (patch-notes version)

**Patch-notes version:** `UNRELEASED` (working bucket). Before merging to `main`, run `npm run prepare-merge` so this folder is frozen under a semver that matches [package.json](../../../package.json) (see [patchnote/README.md](../../README.md)).

**Role:** Technical **reasons** attached to **this** patch-notes version — file-level and behavior-level inventory. Public-facing copy at other depths lives only under [public/](public/).

---

## Summary

_Add a one-line roll-up here when the buffer gets long._

---

## By area

### Repo / docs

- ADR [0006-tutorial-room-portrait-path.md](../../../docs/adr/0006-tutorial-room-portrait-path.md): Tutorial Room authored as south→north portrait **Tutorial Path**; glossary term in `CONTEXT.md`.

### Client

- _(none in this change set)_

### Server

- `tutorialTemplate/bootstrapShell.ts`: default Tutorial Template is 7×15 portrait corridor (Mine alcove south, pay gate mid-north, exit north); path floor strip; existing block shapes only. Fresh empty template stores pick this up; existing published templates need staging republish / resync.

### payment-intent-service

- _(none in this change set)_

### Deploy / ops

- Existing deploys with a persisted Tutorial Template keep the old square layout until operators republish from Tutorial Staging (or clear the template store so bootstrap recreates the default).
