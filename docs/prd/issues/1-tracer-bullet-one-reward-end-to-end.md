# Tracer bullet — one reward end-to-end via the Payout Service

## Parent

[PRD — Dedicated NIM Payout Service](../payout-service.md)

## What to build

Stand up the **Payout Service** as a separate, localhost-bound sidecar process with its own image, a health endpoint, shared **Bearer-secret** auth on all non-health routes, and a single chain chokepoint that a fake client can replace in tests.

Implement the minimal happy path for **block-claim rewards only**: an enqueue endpoint that accepts a **Pay-Intent** (idempotent by `claimId`), persists it to the service's durable queue, and sends it through the chain chokepoint.

In the game server, back the gateway's enqueue with a durable, append-only **Outbox** plus a delivery loop that ships intents to the service with retries and removes them on acknowledgement.

End-to-end, against a fake chain, a block claim results in **exactly one** send through the service. This is the skeleton every later slice hangs off.

## Acceptance criteria

- [ ] The Payout Service runs as its own process/image, binds to localhost, requires the Bearer secret on all non-health routes, and answers a health check.
- [ ] Block-claim rewards flow game server → Outbox → service → send, demonstrated end-to-end against a fake chain client.
- [ ] Enqueue is idempotent by `claimId`: the same intent delivered twice yields one send.
- [ ] Intents persist in the Outbox until acknowledged; an unacknowledged intent is redelivered.
- [ ] The service queue persists across a service restart.
- [ ] Tests cover service enqueue/send (fake chain) and game-server Outbox/delivery (stub service).

## Blocked by

- [0 — Prefactor: in-process payout gateway](0-prefactor-payout-gateway.md)
