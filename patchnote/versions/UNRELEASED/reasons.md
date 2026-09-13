# Reasons — UNRELEASED (patch-notes version)

**Patch-notes version:** `UNRELEASED` (working bucket). Before merging to `main`, run `npm run prepare-merge` so this folder is frozen under a semver that matches [package.json](../../../package.json) (see [patchnote/README.md](../../README.md)).

**Role:** Technical **reasons** attached to **this** patch-notes version — file-level and behavior-level inventory. Public-facing copy at other depths lives only under [public/](public/).

---

## Summary

Nimiq Space now receives **Live Events** from NimiqLIVE (`POST /api/live-events`) and maps `nimiqlive.test` to a reversible **Live Boost** World Effect (2× gameplay NIM + gold banner). Duplicate Live Event Ids do not stack.

---

## By area

### Repo / docs

- Recorded Live Event / World Effect split in `docs/THE-LARGER-SYSTEM.md` (`docs/reasons/reason_619473.md`). Env + route in `docs/process.md`, `docs/features-checklist.md`, `docs/live-service-implementation.md`.

### Client

- Gold **Live Boost** banner on the letterbox (visible in stream cinema) from `liveWorldEffect` / `welcome.liveWorldEffect`.

### Server

- `POST /api/live-events`: wallet JWT allowlist (`LIVE_EVENT_ADDRESSES`), guest reject, SQLite idempotency, unknown types accepted no-op. `nimiqlive.test` → Live Boost via room authority (`applyLiveEarnMultiplier` on mining, Maze first place, Free Play goals).

### payment-intent-service

- _(none in this change set)_

### Deploy / ops

- Operators set **`LIVE_EVENT_ADDRESSES`** to the NimiqLIVE Wallet (must already have accepted Space terms). Optional `LIVE_EVENT_STORE_FILE`, `LIVE_EVENT_TEST_BOOST_MS`.
