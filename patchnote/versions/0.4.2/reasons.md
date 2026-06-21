# Reasons — 0.4.2 (patch-notes version)

**Patch-notes version:** `0.4.2` (frozen via `npm run prepare-merge`).

**Role:** Technical **reasons** attached to **this** patch-notes version — file-level and behavior-level inventory. Public-facing copy at other depths lives only under [public/](public/).

---

## Summary

Outgoing NIM payouts move to a dedicated **Payout Service** sidecar; the game server enqueues Pay-Intents via a durable Outbox and no longer runs the in-process Nimiq payout worker. Production compose starts `payout` by default; deploy pipeline idempotently migrates legacy payout files into `data/payout-service/`. `/admin/system` probes payout (and payment-intent) health with status tones.

---

## By area

### Repo / docs

- [docs/adr/0002-payouts-in-dedicated-sidecar-service.md](../../../docs/adr/0002-payouts-in-dedicated-sidecar-service.md) — ADR (prior).
- [docs/prd/payout-service.md](../../../docs/prd/payout-service.md), [docs/prd/issues/](../../../docs/prd/issues/) — PRD slices including production cutover (#6).
- [docs/payout-cutover-runbook.md](../../../docs/payout-cutover-runbook.md) — hard cutover steps, verification, rollback warnings.
- [docs/docker-deployment.md](../../../docs/docker-deployment.md), [docs/deploy-github-docker.md](../../../docs/deploy-github-docker.md), [docs/live-service-implementation.md](../../../docs/live-service-implementation.md), [docs/features-checklist.md](../../../docs/features-checklist.md), [docs/nim-payout-tracing.md](../../../docs/nim-payout-tracing.md) — updated for sidecar posture.
- [scripts/migrate-payout-data-to-sidecar.sh](../../../scripts/migrate-payout-data-to-sidecar.sh) — idempotent legacy `data/nim-payout-*` → `data/payout-service/`.

### Client

- _(no player-visible UI for sidecar itself; latency graph / debug panel unchanged — payout stalls should no longer correlate on game server.)_

### Server

- **Removed** [server/src/nimPayout/](../../../server/src/nimPayout/) — in-process queue, signer, balance Nimiq client.
- [server/src/payoutGateway.ts](../../../server/src/payoutGateway.ts) — Outbox + HTTP client only (no in-process fallback).
- [server/src/payoutOutbox.ts](../../../server/src/payoutOutbox.ts), [server/src/payoutServiceClient.ts](../../../server/src/payoutServiceClient.ts), [server/src/payoutBalancePull.ts](../../../server/src/payoutBalancePull.ts) — at-least-once delivery, balance pull cache for claim gating.
- [server/src/payoutServiceProbe.ts](../../../server/src/payoutServiceProbe.ts) — `/admin/system` reachability + auth probe for payout sidecar.
- [server/src/paymentIntentProbe.ts](../../../server/src/paymentIntentProbe.ts) — adds `statusTone`, `logsHint` for sidecar cards.
- [server/src/adminSystemPage.ts](../../../server/src/adminSystemPage.ts) — green/yellow/red sidecar status, log command hints.
- [server/src/index.ts](../../../server/src/index.ts) — snapshot includes `payoutService`; always starts outbox + balance pull loops.
- Env: game server uses `PAYOUT_SERVICE_URL`, `PAYOUT_SERVICE_API_SECRET`; **`NIM_PAYOUT_PRIVATE_KEY` must not be used on nspace** (compose clears it).

### payout-service (new workspace)

- [payout-service/](../../../payout-service/) — HTTP API (`/health`, `/v1/pay-intents`, balance, pending, flush, manual bulk); owns queue, signer, retries, dead-letter.
- [payout-service/Dockerfile](../../../payout-service/Dockerfile), compose service **`payout`** on `127.0.0.1:3091`, volume `./data/payout-service:/data`.

### payment-intent-service

- _(unchanged in this release)_

### Deploy / ops

- [docker-compose.yml](../../../docker-compose.yml) — **`payout` runs by default** (removed `profiles: ["payout"]`); `nspace` `depends_on: payout`, default `PAYOUT_SERVICE_URL=http://payout:3091`; `NIM_PAYOUT_PRIVATE_KEY: ""` on `nspace`.
- [.github/workflows/deploy-docker.yml](../../../.github/workflows/deploy-docker.yml) — after backup + `git reset`, runs migrate script before `docker compose build`.
- Operator env: `PAYOUT_SERVICE_API_SECRET` on both services; signer key and `NIM_NETWORK` on **payout** only; see [payout-service/.env.example](../../../payout-service/.env.example), [server/.env.example](../../../server/.env.example).
