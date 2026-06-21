# Reliability — retries, dead-letter, durability

## Parent

[PRD — Dedicated NIM Payout Service](../payout-service.md)

## What to build

Add the full reliability behavior end-to-end.

In the service: failed sends **retry with backoff** and move to **dead-letter** after the configured attempts; a process restart resumes in-flight jobs **without double-sending**.

In the game server: harden the Outbox delivery loop so a Pay-Intent survives both a payout-service outage **and** a game-server restart, relying on `claimId` idempotency for safe redelivery.

## Acceptance criteria

- [ ] A repeatedly failing send backs off and is dead-lettered after the threshold, recorded for audit.
- [ ] A service restart mid-queue resumes without sending any job twice.
- [ ] An intent earned while the service is unreachable is delivered once the service returns — even with a game-server restart in between.
- [ ] Redelivery never causes a double-send (`claimId` dedupe verified under retry).
- [ ] Tests cover backoff → dead-letter and cross-restart durability/idempotency.

## Blocked by

- [1 — Tracer bullet: one reward end-to-end via the Payout Service](1-tracer-bullet-one-reward-end-to-end.md)
