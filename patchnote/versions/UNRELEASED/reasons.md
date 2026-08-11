# Reasons — UNRELEASED (patch-notes version)

**Patch-notes version:** `UNRELEASED` (working bucket). Before merging to `main`, run `npm run prepare-merge` so this folder is frozen under a semver that matches [package.json](../../../package.json) (see [patchnote/README.md](../../README.md)).

**Role:** Technical **reasons** attached to **this** patch-notes version — file-level and behavior-level inventory. Public-facing copy at other depths lives only under [public/](public/).

---

## Summary

Bump `@nimiq/core` to **2.7.2** so light clients can establish mainnet consensus after ZKP sync was removed from seed nodes (hard fork).

---

## By area

### Repo / docs

- `docs/LEARNEDLESSONS.md` — note removal of the `2.2.2` worker patch and the post-fork client requirement.

### Client

- _(none in this change set)_

### Server

- `@nimiq/core` pin → **2.7.2** (workspace + root `overrides`).

### payment-intent-service

- `@nimiq/core` pin → **2.7.2** (same pico / non-ZKP sync path as payout).

### payout-service

- `@nimiq/core` pin → **2.7.2**. Required so `/v1/balance` and sends can pass `waitForConsensusEstablished()` against current mainnet seeds (ZKP sync no longer offered).

### Deploy / ops

- Remove `patches/@nimiq+core+2.2.2.patch` (does not apply to 2.7.2). Redeploy **payout** (and **payment-intent** if used) images after merge; game server also picks up the shared pin on rebuild.
