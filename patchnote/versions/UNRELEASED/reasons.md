# Reasons — UNRELEASED (patch-notes version)

**Patch-notes version:** `UNRELEASED` (working bucket). Before merging to `main`, run `npm run prepare-merge` so this folder is frozen under a semver that matches [package.json](../../../package.json) (see [patchnote/README.md](../../README.md)).

**Role:** Technical **reasons** attached to **this** patch-notes version — file-level and behavior-level inventory. Public-facing copy at other depths lives only under [public/](public/).

---

## Summary

Show the QR place code on the phone as soon as the sign-in page opens, so it matches the computer before the wallet signs.

---

## By area

### Repo / docs

- [docs/features-checklist.md](../../../docs/features-checklist.md) notes the phone shows `placeCode` as soon as the QR page opens.

### Client

- Phone QR sign-in screen (`client/src/auth/qrPayLoginPhone.ts`) shows `placeCode` with the same **This screen is** label as the desktop dialog while the ticket is still waiting for a signature. The confirm card keeps **Sign in on {code}?** and hides the larger code.

### Server

- _(none in this change set)_

### payment-intent-service

- _(none in this change set)_

### Deploy / ops

- _(none in this change set)_
