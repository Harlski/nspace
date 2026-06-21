# Balance — cached pull + claim gating

## Parent

[PRD — Dedicated NIM Payout Service](../payout-service.md)

## What to build

Move the payout-wallet balance behind the Payout Service while keeping the claim hot path non-blocking.

The service serves the balance from its own cache (Nimiq-backed via the chain chokepoint) and **decrements the cached balance after a successful send**. The game server periodically **pulls** that balance into a local cache on the existing refresh cadence; claim fund-gating reads the **local cached value with no network call**, and the HUD balance endpoint serves/proxies the same cached value under the existing staleness tolerance.

## Acceptance criteria

- [ ] The service exposes a Bearer-authed balance read backed by its cache.
- [ ] After a successful send, the service's cached balance reflects the decrement.
- [ ] The game server pulls and caches the balance on its refresh cadence.
- [ ] Claim fund-gating reads the cached value with no synchronous network call and behaves identically to today's peek (including staleness tolerance).
- [ ] The HUD payout-balance path returns the service-sourced cached value.
- [ ] Tests cover service balance + post-send decrement (fake chain) and game-server cached gating without a network call (stub service).

## Blocked by

- [1 — Tracer bullet: one reward end-to-end via the Payout Service](1-tracer-bullet-one-reward-end-to-end.md)
