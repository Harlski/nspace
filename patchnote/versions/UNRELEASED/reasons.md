# Reasons — UNRELEASED (patch-notes version)

**Patch-notes version:** `UNRELEASED` (working bucket). Before merging to `main`, run `npm run prepare-merge` so this folder is frozen under a semver that matches [package.json](../../../package.json) (see [patchnote/README.md](../../README.md)).

**Role:** Technical **reasons** attached to **this** patch-notes version — file-level and behavior-level inventory. Public-facing copy at other depths lives only under [public/](public/).

---

## Summary

CI deploy: pre-stop **`curl`** must not use **`-f`** on the restart hook so **404** (first deploy after hook lands, or `not_configured`) never fails **`script_stop`** SSH.

---

## By area

### Repo / docs

- _(none yet)_

### Client

- _(none in this change set)_

### Server

- _(none in this change set)_

### payment-intent-service

- _(none in this change set)_

### Deploy / ops

- [`.github/workflows/deploy-docker.yml`](../../.github/workflows/deploy-docker.yml): pre-deploy **`curl`** no longer uses **`-f`** so HTTP **404** (old binary without hook, or hook `not_configured`) does not fail the SSH step under **`script_stop: true`**; **200** → **60s** wait, **404** → short skip, other → **5s** then continue.
