# Reasons — UNRELEASED (patch-notes version)

**Patch-notes version:** `UNRELEASED` (working bucket). Before merging to `main`, run `npm run prepare-merge` so this folder is frozen under a semver that matches [package.json](../../../package.json) (see [patchnote/README.md](../../README.md)).

**Role:** Technical **reasons** attached to **this** patch-notes version — file-level and behavior-level inventory. Public-facing copy at other depths lives only under [public/](public/).

---

## Summary

_Add a one-line roll-up here when the buffer gets long._

---

## By area

### Repo / docs

- _(none yet)_

### Client

- _(none in this change set)_

### Server

- `GET /api/admin/player/activity` (system admin) proxies one wallet's login history from the Analytics Service. `hours` is `24` (default) or `168`.
- `/admin/user/:profile` draws connected vs active spans, an hourly (or daily) column chart, gameplay NIM marks, and a session table. The Activity block's older NIM lines are labeled as payouts sent.

### Analytics service

- `GET /v1/player-activity` scans the Event Log for one address. Connected is `session_start` to `session_end`. Active uses the 5-minute idle cap shared with the hourly digest. Headline totals are unions. Gameplay NIM is `claim_block` / `gameplay_nim_earned`, deduped by `claimId`. An open session extends to the window end only when the game reports the wallet online.

### payment-intent-service

- _(none in this change set)_

### Deploy / ops

- _(none in this change set)_
