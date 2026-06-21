# Production cutover

## Parent

[PRD — Dedicated NIM Payout Service](../payout-service.md)

## What to build

Make the Payout Service the **sole** payout path in production.

Set the compose posture so the service runs **by default**; move the signer key into the service's environment and **remove it from the game server**; **remove the in-process payout processor** so only the service ever sends (single-processor invariant); and hand over the existing payout data directory **unchanged** to the service's volume. Provide a migration runbook for the single-release **hard cutover** (stop in-process processor → hand over data dir → start service).

Run `/review-security` on the diff before this slice ships (key relocation, inter-service auth, idempotency, double-spend).

## Acceptance criteria

- [x] The Payout Service runs by default in the production compose (no opt-in profile).
- [x] The signer key exists only in the service's environment; the game server has no signer key and no chain client.
- [x] The in-process payout processor is removed; no game-server code path can send NIM directly.
- [x] The existing payout data directory is consumed unchanged by the service (no format transform).
- [x] A documented runbook covers the hard cutover with no dual-processor window.
- [x] Post-cutover verification: game-server `[event-loop]` stalls disappear and the in-profile latency graph flattens during payout activity.

## Blocked by

- [1 — Tracer bullet: one reward end-to-end via the Payout Service](1-tracer-bullet-one-reward-end-to-end.md)
- [2 — Balance: cached pull + claim gating](2-balance-cached-pull-and-claim-gating.md)
- [3 — Reliability: retries, dead-letter, durability](3-reliability-retries-dead-letter-durability.md)
- [4 — Remaining reward triggers onto the outbox](4-remaining-reward-triggers.md)
- [5 — Admin & reporting proxied](5-admin-and-reporting-proxied.md)
