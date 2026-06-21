# Prefactor — in-process payout gateway

## Parent

[PRD — Dedicated NIM Payout Service](../payout-service.md)

## What to build

Introduce a single in-process **payout gateway** in the game server through which every payout interaction flows: enqueueing a Pay-Intent (all four reward triggers), reading the payout-wallet balance (for claim fund-gating and the HUD), triggering a manual bulk payout for a recipient, triggering the end-of-day flush, and reading pending-summary / history for reporting.

For now the gateway delegates straight to the existing in-process payout logic — **no behavior change**. The point is to create exactly one chokepoint so a later slice can swap the implementation to an HTTP client for the Payout Service in a single place. "Make the change easy, then make the easy change."

## Acceptance criteria

- [ ] All four reward triggers enqueue Pay-Intents via the gateway, not by calling payout internals directly.
- [ ] Claim fund-gating and the HUD balance both read balance via the gateway.
- [ ] Admin "Payout in full" and the end-of-day flush invoke the gateway.
- [ ] Pending-summary / history reads used by reporting go through the gateway.
- [ ] No change to observable payout behavior; existing payout and reward tests pass unchanged.
- [ ] The gateway is the only place in the game server that references payout internals.

## Blocked by

None - can start immediately.
