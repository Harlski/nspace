# ADR 0003 — Guest sessions & Direct Invite

**Status:** Accepted  
**Date:** 2026-06-22  
**Context:** [PRD-direct-invite.md](../PRD-direct-invite.md), [CONTEXT.md](../CONTEXT.md)

## Decision

Direct Invite uses **ephemeral guest JWT sessions** distinct from wallet sessions:

- `sub` is `guest:{guestId}` (never an `NQ…` wallet).
- Claims: `guest: true`, `guestId`, `displayName`, optional `inviteSlug`, optional `upgradedWallet`.
- WebSocket connections still require a valid JWT — guests are authenticated, not anonymous.
- Wallet sign-in on the invite splash **upgrades in place**: re-issue JWT preserving `guestId` and invite binding while adding wallet identity.

Invite lifecycle truth lives in **`server/src/directInvite/`** (pure reducer + in-memory store). `rooms.ts` only teleports connections, broadcasts lobby snapshots, and calls existing `worldcupBeginMatch` on host start.

## Threat model (v1)

| Risk | Mitigation |
|------|------------|
| Slug guessing | ~48 bits entropy (URL-safe random 8–10 chars); single guest slot |
| Slot squatting | First `guestId` to claim wins; same `guestId` may reclaim (cookie + JWT) |
| Stale invites | 15-minute TTL; tick-driven expiry |
| Guest → treasury | Guest sessions have no payout/admin paths; Matches never pay NIM (ADR 0002) |
| Double-booking | Host cannot open Challenge and Direct Invite simultaneously |

## Consequences

- Auth and WS connect paths must branch on `guest:` prefix for display names.
- Server restart drops in-flight invites (acceptable v1 — fail closed).
- Deprecation: delete `server/src/directInvite/` and `rooms.ts` hook blocks; guest JWT branch in auth can remain harmless.
