# Reasons — UNRELEASED (patch-notes version)

**Patch-notes version:** `UNRELEASED` (working bucket). Before merging to `main`, run `npm run prepare-merge` so this folder is frozen under a semver that matches [package.json](../../../package.json) (see [patchnote/README.md](../../README.md)).

**Role:** Technical **reasons** attached to **this** patch-notes version — file-level and behavior-level inventory. Public-facing copy at other depths lives only under [public/](public/).

---

## Summary

Wallet sign-in no longer loops Loading the Hub for accounts that already have a username. Profile lookup ignores spaces in the session address, and a username-required socket close does not reconnect when a name is already set.

---

## By area

### Repo / docs

- _(none yet)_

### Client

- [client/src/auth/usernamePromptGate.ts](../../../client/src/auth/usernamePromptGate.ts): gate result is `ready`, `saved`, or `blocked`.
- [client/src/main.ts](../../../client/src/main.ts): close `4009` reconnects only after `saved`.

### Server

- [server/src/playerProfileStore.ts](../../../server/src/playerProfileStore.ts): `profileWalletKey` strips spaces before every profile read and write.
- [server/src/moderationStore.ts](../../../server/src/moderationStore.ts): username-set ban lookup uses the same compact key as the write path.

### payment-intent-service

- _(none in this change set)_

### Deploy / ops

- _(none in this change set)_
