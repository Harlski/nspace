# Reasons — 0.6.5 (patch-notes version)

**Patch-notes version:** `0.6.5` (frozen via `npm run prepare-merge`).

**Role:** Technical **reasons** attached to **this** patch-notes version — file-level and behavior-level inventory. Public-facing copy at other depths lives only under [public/](public/).

---

## Summary

Tutorial faucet Pay-Intents jump the outgoing NIM queue via optional `priority: true` on both the Outbox and Payout Service picker. Hub "Welcome to Nimiq Space" waits until the room loading overlay has fully faded out.

---

## By area

### Repo / docs

- [docs/THE-LARGER-SYSTEM.md](../../../docs/THE-LARGER-SYSTEM.md) + [docs/reasons/reason_981786.md](../../../docs/reasons/reason_981786.md) — first-contact faucet priority recorded decision
- [CONTEXT.md](../../../CONTEXT.md) — Priority Pay-Intent vocabulary
- [docs/features-checklist.md](../../../docs/features-checklist.md), [docs/docker-deployment.md](../../../docs/docker-deployment.md) — priority Pay-Intent / auto-bulk exclusion

### Client

- [client/src/ui/hud.ts](../../../client/src/ui/hud.ts) — `setLoadingVisible(false)` returns a Promise that resolves when the overlay has fully dismissed
- [client/src/main.ts](../../../client/src/main.ts) — await loading dismiss before tutorial Hub welcome cinematic

### Server

- [server/src/payoutServiceClient.ts](../../../server/src/payoutServiceClient.ts) — `PayIntent.priority?: boolean`; HTTP body forwards it
- [server/src/payoutOutbox.ts](../../../server/src/payoutOutbox.ts) — persist + deliver priority intents before normal
- [server/src/rooms.ts](../../../server/src/rooms.ts) — tutorial faucet enqueue sets `priority: true`
- [server/test/payoutOutbox.test.ts](../../../server/test/payoutOutbox.test.ts) — priority delivery order

### payout-service

- [payout-service/src/queue.ts](../../../payout-service/src/queue.ts) — `priority` on job/body; strict priority pick; auto-bulk `excludePriority`
- [payout-service/test/priority.test.ts](../../../payout-service/test/priority.test.ts) — picker + auto-bulk exclusion

### payment-intent-service

- _(none in this change set)_

### Deploy / ops

- Bump **game server** and **payout** images together so priority field is understood end-to-end (old payout service ignores unknown JSON fields safely, but would not prioritize until upgraded)
