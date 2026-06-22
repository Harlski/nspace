# ADR 0003 — Guest sessions & Direct Invite

**Status:** Accepted (amended — see Update)  
**Date:** 2026-06-22  
**Context:** [PRD-direct-invite.md](../PRD-direct-invite.md), [CONTEXT.md](../CONTEXT.md)

## Update (UNRELEASED) — Direct Invite → multi-person **Play Space**

The 1:1 staging lobby became a private, multi-person **Play Space** (see **Play Space** /
**Guest** in [worldcup/CONTEXT.md](../CONTEXT.md)). What changed from the original decision:

- **Multi-participant model.** `DirectInviteRecord` holds a `participants[]` collection +
  `capacity`; phases collapse to `open` / `closed` / `expired`. `claimInvite` is additive and
  cap-gated (`MAX_PLAY_SPACE_OCCUPANTS`, env `DIRECT_INVITE_MAX_OCCUPANTS`, default 8).
- **In-room play, not host-start.** There is no host "Start Match"; **any** occupant raises a
  normal **Challenge** in the space. Matches return players to the Play Space and surface the
  Spectate Portal there. `startDirectInviteMatch` was removed; `cancelDirectInvite` now means
  "leave the space".
- **Guest confinement.** Guests may only occupy their Play Space and the Match Pitches it
  launches; `joinRoom`/`enterPortal`/arbitrary-room connect are blocked, and WS connect forces
  a guest onto their own space (also fixing the `resume=1` → chamber bug for fresh guests).
- **Lifecycle by occupancy.** The space is torn down only when no connected socket carries its
  slug (so it survives active Matches); the creator comes and goes freely.
- **NIM exclusion is explicit.** `evaluateGoalReward` rejects `guest:*` scorers (`isGuestWallet`),
  defence-in-depth beyond "Matches never pay".

The guest-session decisions below (ephemeral `guest:{guestId}` JWTs, in-place wallet upgrade,
reducer/store ownership) are unchanged.

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
