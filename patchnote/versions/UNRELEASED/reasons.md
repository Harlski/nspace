# Reasons — UNRELEASED (patch-notes version)

**Patch-notes version:** `UNRELEASED` (working bucket). Before merging to `main`, run `npm run prepare-merge` so this folder is frozen under a semver that matches [package.json](../../../package.json) (see [patchnote/README.md](../../README.md)).

**Role:** Technical **reasons** attached to **this** patch-notes version — file-level and behavior-level inventory. Public-facing copy at other depths lives only under [public/](public/).

---

## Summary

Play Space Templates (admin Build Shell library + default/archive/resync) and ephemeral in-session co-building in Play Spaces.

---

## By area

### Repo / docs

- `worldcup/adr/0004-play-space-templates.md` — ADR for template store, future-only resync, ephemeral edits vs guest confinement.
- `docs/features-checklist.md`, `docs/process.md` — template persistence path, admin API, ephemeral edits.
- `worldcup/issues/100–105` — local implementation tracking (done).

### Client

- `client/src/invite/playSpaceTemplatePicker.ts` — admin-only template picker when multiple active templates exist.
- `client/src/invite/api.ts` — `createDirectInvite(token, { templateId? })`.
- `client/src/main.ts` — wires picker into both Play Space create paths (shared `onOpenPlaySpace` handler).
- `client/src/invite/playSpaceLayout.ts` — case-sensitive 8-char slug join resolution (fixes Rooms join-code regression).

### Server

- `server/src/playSpaceTemplate/` — Build Shell extract/apply, JSON store (`play-space-templates.json`), admin HTTP routes.
- `server/src/directInvite/*` — `DirectInviteRecord.templateId`; create resolves default or admin-picked template.
- `server/src/rooms.ts` — template-driven `ensurePlaySpaceLayout`, ephemeral edit permissions, teleporter/gate placement blocked in invite-lobby.
- `server/src/worldPersistence.ts` — skip persisting invite-lobby room ids.
- `server/src/adminRoomsPage.ts` — Play Space templates tab (create, default, resync, archive).
- `server/test/playSpaceTemplate.test.ts` — store + build shell unit tests.

### payment-intent-service

- _(none in this change set)_

### Deploy / ops

- _(none in this change set)_
