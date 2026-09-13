# Reasons — UNRELEASED (patch-notes version)

**Patch-notes version:** `UNRELEASED` (working bucket). Before merging to `main`, run `npm run prepare-merge` so this folder is frozen under a semver that matches [package.json](../../../package.json) (see [patchnote/README.md](../../README.md)).

**Role:** Technical **reasons** attached to **this** patch-notes version — file-level and behavior-level inventory. Public-facing copy at other depths lives only under [public/](public/).

---

## Summary

Nimiq Space now receives **Live Events** from NimiqLIVE (`POST /api/live-events`) and maps them to World Effects. Built-in `nimiqlive.test` is **Live Boost**. Operators override type → interaction and room (current / hub / other) on `/admin/live-events`. Duplicate Live Event Ids do not stack.

---

## By area

### Repo / docs

- Recorded Live Event / World Effect split in `docs/THE-LARGER-SYSTEM.md` (`docs/reasons/reason_619473.md`, operator mapping `docs/reasons/reason_482736.md`). Env + route in `docs/process.md`, `docs/features-checklist.md`, `docs/live-service-implementation.md`.

### Client

- Gold **Live Boost** banner on the letterbox (visible in stream cinema) from `liveWorldEffect` / `welcome.liveWorldEffect`.

### Server

- `POST /api/live-events`: wallet JWT allowlist (`LIVE_EVENT_ADDRESSES`), guest reject, SQLite idempotency, unknown types accepted no-op. `nimiqlive.test` → Live Boost via room authority (`applyLiveEarnMultiplier` on mining, Maze first place, Free Play goals). Operator mapping table + `/admin/live-events` (current / hub / other room; reserved interactions save without applying).

### payment-intent-service

- _(none in this change set)_

### Deploy / ops

- Operators set **`LIVE_EVENT_ADDRESSES`** to the NimiqLIVE Wallet (must already have accepted Space terms). Optional `LIVE_EVENT_STORE_FILE`, `LIVE_EVENT_TEST_BOOST_MS`. Map incoming types on **`/admin/live-events`**.
