# Reasons — UNRELEASED (patch-notes version)

**Patch-notes version:** `UNRELEASED` (working bucket). Before merging to `main`, run `npm run prepare-merge` so this folder is frozen under a semver that matches [package.json](../../../package.json) (see [patchnote/README.md](../../README.md)).

**Role:** Technical **reasons** attached to **this** patch-notes version — file-level and behavior-level inventory. Public-facing copy at other depths lives only under [public/](public/).

---

## Summary

Wallet sign-in no longer loops Loading the Hub for accounts that already have a username. Profile lookup ignores spaces in the session address, and a username-required socket close does not reconnect when a name is already set. The admin player dossier shows a 24-hour login history of connected time, active play, and gameplay NIM.

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
- `GET /api/admin/player/activity` (system admin) proxies one wallet's login history from the Analytics Service. `hours` is `24` (default) or `168`.
- `/admin/user/:profile` draws connected vs active spans, an hourly (or daily) column chart, gameplay NIM marks, and a session table. The Activity block's older NIM lines are labeled as payouts sent.

### Analytics service

- `GET /v1/player-activity` scans the Event Log for one address. Connected is `session_start` to `session_end`. Active uses the 5-minute idle cap shared with the hourly digest. Headline totals are unions. Gameplay NIM is `claim_block` / `gameplay_nim_earned`, deduped by `claimId`. An open session extends to the window end only when the game reports the wallet online.

### payment-intent-service

- _(none in this change set)_

### Deploy / ops

- _(none in this change set)_
