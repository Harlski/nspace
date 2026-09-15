# Reasons — UNRELEASED (patch-notes version)

**Patch-notes version:** `UNRELEASED` (working bucket). Before merging to `main`, run `npm run prepare-merge` so this folder is frozen under a semver that matches [package.json](../../../package.json) (see [patchnote/README.md](../../README.md)).

**Role:** Technical **reasons** attached to **this** patch-notes version — file-level and behavior-level inventory. Public-facing copy at other depths lives only under [public/](public/).

---

## Summary

Return Walk: Resident Invoice HTTP, credited 1000 NIM Deposit, server-owned Upgrade Windows, Return Gold on the play snapshot paid from the Server Wallet.

---

## By area

### Repo / docs

- Glossary: [CONTEXT.md](../../../CONTEXT.md) Return Walk terms (Invoice, Deposit, Return Budget, Upgrade Window, Return Gold, Server Wallet, Resident, Public Room, Quiet-Claim).
- [docs/THE-LARGER-SYSTEM.md](../../../docs/THE-LARGER-SYSTEM.md) + [docs/reasons/reason_647281.md](../../../docs/reasons/reason_647281.md): prepaid Return Budget is not the Stream Faucet; Upgrade Windows are server-owned; player JWT seam (not admin / not `?stream=1`).
- Env / ops: [docs/process.md](../../../docs/process.md), [docs/features-checklist.md](../../../docs/features-checklist.md), [docs/getting-started.md](../../../docs/getting-started.md), [docs/docker-deployment.md](../../../docs/docker-deployment.md), [docs/live-service-implementation.md](../../../docs/live-service-implementation.md), [docs/build.md](../../../docs/build.md), [AGENTS.md](../../../AGENTS.md).

### Client

- Obstacle wire: optional `kind: "returnGold"` / `returnGold: true` on `welcome` / `obstacles` / `obstaclesDelta` ([client/src/net/ws.ts](../../../client/src/net/ws.ts), [client/src/game/Game.ts](../../../client/src/game/Game.ts), [client/src/game/blockStyle.ts](../../../client/src/game/blockStyle.ts)). Gold Blocks stay `claimable` without `kind`. Same claim protocol as Gold Blocks.

### Server

- Module [server/src/returnWalk/](../../../server/src/returnWalk/): allowlist `RESIDENT_ADDRESSES`, Server Wallet `RETURN_WALK_SERVER_WALLET_ADDRESS` (rejected if Stream Faucet), SQLite Invoices (`RETURN_WALK_STORE_FILE`), HTTP Invoice + directory, credit watch (`NIM_RPC_URL`), Upgrade Windows, Return Gold payout enqueue.
- Routes (player JWT, not `/api/admin/*`):
  - `POST /api/resident/return-walk/invoices` `{ amountNim: 1000 }`
  - `GET /api/resident/return-walk/invoices/:invoiceId`
  - `POST /api/resident/return-walk/invoices/:invoiceId/tx` `{ txHash }`
  - `GET /api/resident/public-rooms`
- Play authority in [server/src/rooms.ts](../../../server/src/rooms.ts): snapshot `kind`/`returnGold`, convert ordinary solids, revert after claim, start/cancel Upgrade Windows, directory gold + `realPresenceCount`.
- Pay-Intent `source: "returnWalk"` ([server/src/payoutServiceClient.ts](../../../server/src/payoutServiceClient.ts), [server/src/payoutOutbox.ts](../../../server/src/payoutOutbox.ts)).

### payout-service

- Dual signer: Stream Faucet `NIM_PAYOUT_PRIVATE_KEY` vs Server Wallet `RETURN_WALK_PRIVATE_KEY`.
- Bulk / auto-bulk skip `source: "returnWalk"` jobs.
- Compose: `RETURN_WALK_PRIVATE_KEY` on `payout`; stripped from `nspace`.

### payment-intent-service

- _(none in this change set)_

### Deploy / ops

- New env: `RESIDENT_ADDRESSES`, `RETURN_WALK_SERVER_WALLET_ADDRESS`, `NIM_RPC_URL`, `RETURN_WALK_STORE_FILE`, `RETURN_WALK_PRIVATE_KEY`.
- Persist `server/data/return-walk.sqlite` on the game data volume.
