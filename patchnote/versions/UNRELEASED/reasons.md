# Reasons — UNRELEASED (patch-notes version)

**Patch-notes version:** `UNRELEASED` (working bucket). Before merging to `main`, run `npm run prepare-merge` so this folder is frozen under a semver that matches [package.json](../../../package.json) (see [patchnote/README.md](../../README.md)).

**Role:** Technical **reasons** attached to **this** patch-notes version — file-level and behavior-level inventory. Public-facing copy at other depths lives only under [public/](public/).

---

## Summary

Admin Invisibility (ops observation mode) for allowlisted admins.

---

## By area

### Repo / docs

- Glossary: **Admin Invisibility** / **Freeze** in `CONTEXT.md` (Freeze not shipped in this slice).

### Client

- Admin overlay Watch tab: Admin Invisibility checkbox (`NSPACE_ADMIN_INVISIBLE`); WS connect `adminInvisible=1`; silent `playerJoined`/`playerLeft`; chat `suppressBubble`; translucent + Invisible nameplate cue for admin viewers.

### Server

- `adminPresence` policy helpers; viewer-aware presence filter on broadcast / welcome; `{ type: "adminInvisible", enabled }`; observation-only world-edit gate while invisible.

### payment-intent-service

- _(none in this change set)_

### Deploy / ops

- _(none in this change set)_
