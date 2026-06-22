---
title: Direct Invite — Guest sessions & out-of-band Match invites
status: ready-for-agent
glossary: CONTEXT.md, worldcup/CONTEXT.md
adrs:
  - worldcup/adr/0001-ephemeral-match-pitches.md
depends_on_grill: .scratch/post-prod/issues/05-guest-invite-system.md
---

# Direct Invite — Guest sessions & out-of-band Match invites

> **Update (UNRELEASED): superseded by the multi-person Play Space.** The 1:1 host→guest
> staging lobby described below evolved into a private, invite-only **Play Space** (up to
> `DIRECT_INVITE_MAX_OCCUPANTS`, default 8): one shared ephemeral room per link where **any**
> occupant raises their own 1v1 Challenges, guests are confined to the space (+ its Match
> Pitches) and never earn NIM, the creator comes and goes freely, and the room is torn down
> only when empty. Phases collapsed to `open`/`closed`/`expired` and the host "Start Match"
> flow was dropped. See **Play Space** / **Guest** in [worldcup/CONTEXT.md](./CONTEXT.md) and
> the Update section of [ADR 0003](./adr/0003-guest-sessions-direct-invite.md). Sections below
> describe the original 1:1 design and are retained for history.

> Vocabulary follows [CONTEXT.md](../CONTEXT.md) (**Guest**, **Direct Invite**) and
> [worldcup/CONTEXT.md](./CONTEXT.md) (**Match**, **Match Pitch**, **Challenge**,
> **Kickoff Countdown**). **Direct Invite** is parallel to **Challenge**, not a
> replacement.

## Problem Statement

Starting a **Match** today requires both players to already be in Nimiq Space with a
connected Nimiq wallet, hanging out in the same social room, and using the public
**Challenge** bubble. That works for spontaneous play among people already online together,
but it fails the common “play with a friend” cases:

- A friend does not have a Nimiq wallet yet and will bounce at sign-in.
- Friends are not in the same room (remote invite over text, or in-person QR scan).
- The host has no in-game signal for whether the friend opened the link, picked a name, or
  is ready.

Players want to share a link or QR, have the friend join in seconds, and start a **Match**
when both are ready — without forcing wallet setup first.

## Solution

A reusable **Direct Invite** flow, shipping first for World Cup 1v1 **Matches**:

1. **Host path (wallet required).** From the **Games Wheel** → **Start Match** sub-choice,
   the host picks **Invite a friend** (vs **Find opponent here**, which keeps today's
   **Challenge**). The server creates a **Direct Invite**, moves the host into a shared
   virtual lobby, and shows a share panel (URL + QR) for `nimiq.space/join/{slug}`.
2. **Guest path (wallet optional).** Opening the link shows a splash (“Joining {host}'s
   Match…”), assigns an editable fun nickname, optionally offers wallet sign-in, then
   places the guest in the same virtual lobby.
3. **Lobby sync.** Host sees live status (waiting → guest arrived → optional signing in).
   When ready, the host taps **Start Match** → existing **Kickoff Countdown** → existing
   **Match Pitch** lifecycle (no NIM, no leaderboard).
4. **Session model.** Guests receive an ephemeral JWT session. Wallet sign-in on the splash
   **upgrades in place** (same invite slot, richer identity) without blocking play.

## User Stories

### Host — creating and sharing

1. As a wallet-authenticated player in a social room, I want **Start Match** on the **Games
   Wheel** to offer two choices — find an opponent here vs invite a friend — so that I pick
   the right matchmaking mode without learning two separate menus.
2. As a host who chose **Invite a friend**, I want a **Direct Invite** created immediately,
   so that I can share before my friend opens the link.
3. As a host, I want to be moved into a shared virtual lobby when I create the invite, so
   that I am already where the Match will start from.
4. As a host in the lobby, I want to see a copyable URL and a QR code for
   `nimiq.space/join/{slug}`, so that I can share remotely or in person.
5. As a host, I want the lobby to show **Waiting for friend…** until someone claims the
   invite, so that I know the link has not been opened yet.
6. As a host, I want to see the guest's chosen nickname when they arrive, so that I know
   the right person joined.
7. As a host, I want to see when the guest is signing in with a wallet on the splash, so
   that I understand a short delay before they appear.
8. As a host, I want a **Start Match** button enabled only when my guest is present in the
   lobby, so that kickoff never fires with a missing opponent.
9. As a host, I want tapping **Start Match** to run the normal **Kickoff Countdown** and
   then teleport us both to a **Match Pitch**, so that the Match feels identical to a
   **Challenge**-started game.
10. As a host, I want to cancel an open **Direct Invite** from the lobby, so that I can
    abandon a stale invite and return to normal play.
11. As a host, I want an expired invite (15 minutes) to close cleanly with a clear message,
    so that I am not stuck in a dead lobby.
12. As a host who already has an open **Challenge**, I want to be blocked from creating a
    **Direct Invite** (and vice versa), so that I cannot be double-booked.

### Guest — joining without friction

13. As a friend without a Nimiq wallet, I want to open `nimiq.space/join/{slug}` and play
    a **Match** without creating a wallet, so that friction does not stop the game.
14. As a guest opener, I want a splash screen that says I am joining the host's **Match**,
    so that I know the link worked.
15. As a guest, I want the server to suggest a fun nickname I can edit or accept with one
    tap, so that I appear as a person rather than “Guest”.
16. As a guest, I want to optionally **Sign in with wallet** on the splash without losing
    my invite slot, so that returning players can use their identity if they want.
17. As a guest who signs in on the splash, I want my session to upgrade in place and keep
    my lobby position, so that I do not have to rejoin.
18. As a guest, I want to land in the same virtual lobby as the host after the splash, so
    that we are together before kickoff.
19. As the guest who first claimed the invite, I want to reopen the same link on a new tab
    or device and still be recognized, so that a refresh does not lock me out.
20. As a different person trying an already-claimed invite, I want a clear “invite already
    in use” message, so that I know the slot is taken.
21. As a guest opening an expired invite, I want a clear “invite expired” message, so that
    I know to ask the host for a new link.
22. As a guest, I want to play the full **Match** (clock, score, goalies, leave/forfeit)
    the same as a wallet player, so that the game is fair and complete.
23. As a guest, I want **Matches** to still earn no NIM and not affect the leaderboard, so
    that guest play does not change the reward economy.

### Challenge parity (unchanged path)

24. As a player who chose **Find opponent here**, I want today's **Challenge** bubble flow
    unchanged, so that spontaneous in-room **Matches** still work.
25. As a nearby player, I want to accept a **Challenge** the same way as today, so that
    **Direct Invite** does not regress public matchmaking.

### Operator & security

26. As the operator, I want **Direct Invite** behind the existing `WORLDCUP_ENABLED` flag,
    so that the seasonal feature can still be switched off wholesale.
27. As the operator, I want invite slugs to be unguessable and single-use per guest slot,
    so that random scanning cannot squat open lobbies.
28. As the operator, I want guest sessions to be short-lived JWTs distinct from wallet
    sessions, so that auth boundaries remain auditable.
29. As the operator, I want invite records to expire automatically after 15 minutes, so
    that stale state does not accumulate.
30. As a maintainer, I want guest-session and invite logic isolated in a dedicated module
    with a pure lifecycle reducer, so that the feature is testable and deletable.

### Future reuse (not built in v1, but shapes the API)

31. As a future mini-game host, I want **Direct Invite** to target activities beyond a
    **Match**, so that the same link/QR pattern can be reused without a rewrite.
32. As a future product owner, I want the `/join/{slug}` route to remain activity-agnostic
    in naming, so that later invites are not World-Cup-branded in the URL.

## Implementation Decisions

Respects [ADR 0001](./adr/0001-ephemeral-match-pitches.md) for ephemeral **Match Pitch**
rooms. Does **not** change [ADR 0002](./adr/0002-nim-rewards-free-play-only.md) — **Matches**
never pay NIM.

Record a new ADR at implementation time for **Guest sessions** (ephemeral JWT, upgrade
path, threat model). That decision is hard to reverse and surprising without context.

### Primary seam (testing & ownership)

All invite lifecycle truth lives in one new server module — **`directInvite`** — exposing:

- A **pure reducer** over invite events (create, claim, reclaim-by-same-guest, nickname
  commit, wallet-upgrade, guest-join-lobby, host-start, cancel, expire, tick).
- A small **invite store** (in-memory map + optional JSON persistence for restart hygiene;
  invites are ephemeral — no long-lived user data).
- **Guest session minting** (JWT claims distinct from wallet `sub`).
- **HTTP handlers** for create, redeem, and nickname submit.
- Thin **`rooms.ts` hooks** only for: placing connections in the virtual lobby room,
  broadcasting lobby snapshots, and calling the existing `worldcupBeginMatch` when the host
  starts.

This mirrors the existing split where `worldcup/match.ts` owns pure Match truth and
`rooms.ts` owns sockets/teleports. **Do not** scatter invite state across `auth.ts`,
`index.ts`, and `rooms.ts` without going through `directInvite`.

Reducer sketch (decision-rich subset):

```ts
type InvitePhase =
  | "open"        // created, no guest yet
  | "claimed"     // guest claimed slot, not necessarily in lobby yet
  | "lobby"       // host + guest both connected in virtual lobby
  | "starting"    // host pressed Start → Kickoff Countdown armed
  | "started"     // handed off to Match machinery
  | "cancelled"
  | "expired";

type InviteEvent =
  | { type: "create"; hostWallet: string; hostOriginRoomId: string; nowMs: number }
  | { type: "claim"; slug: string; guestToken: string; nowMs: number }
  | { type: "reclaim"; slug: string; guestToken: string }
  | { type: "setNickname"; guestToken: string; nickname: string }
  | { type: "upgradeWallet"; guestToken: string; wallet: string }
  | { type: "guestJoinedLobby"; guestToken: string }
  | { type: "hostStart" }
  | { type: "cancel"; by: "host" | "system" }
  | { type: "tick"; nowMs: number };
```

### Guest sessions

- JWT payload extends today's session shape with explicit guest claims, e.g. `guest: true`,
  `guestId` (stable for reclaim), `displayName`, and optional `upgradedWallet` once the
  guest signs in. `sub` for guests uses a dedicated prefix (`guest:…`) so existing code
  paths that assume `NQ…` wallets can branch safely.
- WebSocket connect continues to require a valid session JWT — guests are not anonymous
  connections.
- Wallet upgrade on splash reuses the existing `/api/auth/verify` path, then re-issues a
  JWT that preserves `guestId` + invite binding while adding the wallet identity for
  display and post-match persistence hooks.

### Direct Invite record

- Fields: `slug`, `hostWallet`, `hostOriginRoomId` (snapshot for spectate portal), `phase`,
  `guestId | null`, `guestDisplayName`, `guestWallet | null`, `lobbyRoomId`, `createdAtMs`,
  `expiresAtMs` (create + 15 minutes), `activity: "worldcup-match"` (extensible enum).
- Slug: cryptographically random, URL-safe, ~8–10 chars.
- Claim binding: first `guestId` wins; same `guestId` may reclaim; others rejected.

### Virtual lobby room

- Per-invite ephemeral room (same on-demand room machinery as **Match Pitch**), *not* the
  hub chamber. Both host and guest are teleported in on entry.
- Minimal layout: flat floor, no gameplay objects. Not listable in the public room catalog.
- Lobby UI is client-side overlay driven by server lobby snapshots over the existing
  WebSocket (new message types tagged `directInvite`).

### Match handoff

- On **host Start Match**, resolve both connections in the lobby, then call the existing
  `worldcupBeginMatch(hostConn, guestConn, lobbyRoomId)` so **Kickoff Countdown** runs
  where both players already are.
- On countdown completion, existing `worldcupStartMatch` creates the **Match Pitch** and
  sets `originRoomId` to the host's snapshotted social room (not the lobby) so a **Spectate
  Portal** can still appear where the host stood before inviting — matching **Challenge**
  expectations for onlookers in that room.
- Side assignment: host = side `"a"` (challenger), guest = side `"b"` (accepter).

### HTTP & routing

- `POST /api/invite/create` (wallet JWT) — body includes `activity: "worldcup-match"`;
  returns `{ slug, url, expiresAt }`.
- `GET /api/invite/redeem/:slug` — validates slug + phase + expiry; returns host display
  info for splash; mints or re-mints guest JWT + `guestId` cookie/header contract.
- `POST /api/invite/nickname` (guest JWT) — commits nickname before lobby entry.
- SPA: `/join/:slug` served via existing `index.html` fallback; client bootstrap detects
  join path and runs splash flow before opening the WebSocket.

### Client surfaces

- **Games Wheel** gains a nested **Start Match** level: **Find opponent here** (existing
  Challenge toggle) vs **Invite a friend** (calls create API, enters lobby).
- **Invite splash** page/overlay: host label, nickname field pre-filled from server,
  optional wallet sign-in CTA, continue button.
- **Lobby overlay**: QR + copy URL, status line, guest name, **Start Match** (host only),
  cancel.
- Reuse existing QR generation approach if present; otherwise a small client dependency or
  inline canvas QR is acceptable.

### Guest display names

- Extend or complement the existing `pickGuestDisplayName` curated list with fun
  adjective+noun pairs for true guests (distinct from NPC `[NPC]` prefix names).
- Validate nickname length/charset server-side; profanity filter out of scope for v1 unless
  one already exists for usernames.

### Wire protocol (new, `directInvite`-tagged)

Client→server: `createDirectInvite`, `cancelDirectInvite`, `startDirectInviteMatch`,
`setGuestNickname` (if not folded into HTTP).

Server→client: `directInviteState` (phase, host/guest display names, expiry, share URL),
`directInviteError` (expired, slot taken, etc.).

### Configuration (env)

- `DIRECT_INVITE_TTL_MS` (default `900000` = 15 minutes)
- `GUEST_SESSION_TTL_SEC` (default align with wallet session or shorter, e.g. 4 hours)
- `DIRECT_INVITE_ENABLED` (default follows `WORLDCUP_ENABLED` for v1)

### Modules touched (high level)

| Area | Responsibility |
|------|----------------|
| **`server/src/directInvite/`** (new) | Reducer, store, guest JWT, HTTP handlers |
| **Auth** | Guest claims, upgrade re-issue |
| **Rooms** | Lobby teleport, WS handlers, `worldcupBeginMatch` handoff |
| **HTTP entry** | Route registration, `/join/:slug` bootstrap |
| **Client HUD** | Games Wheel sub-choice |
| **Client invite UI** | Splash, lobby overlay, QR |
| **Client net** | WS types + API helpers |

## Testing Decisions

Good tests assert **external behaviour of pure functions** — inputs in, decisions out —
with no sockets, timers, or disk. Prior art: `server/test/worldcup-match.test.ts` and
`server/test/worldcup-goalReward.test.ts` via `npm test -w server`.

**Single primary suite: `directInvite` reducer + redeem policy**

Table-driven tests over the reducer and small policy helpers:

- Create → `open` with future `expiresAtMs`.
- Claim → `claimed` with `guestId`; second distinct `guestId` on same slug → rejected.
- Reclaim with same `guestId` → allowed in `claimed` and `lobby`.
- Nickname commit → stored sanitized name.
- Wallet upgrade → `guestWallet` set, `guestId` preserved.
- Both in lobby → `lobby`; host Start → `starting`.
- Cancel / expire transitions → `cancelled` / `expired`; redeem after → rejected.
- Tick past `expiresAtMs` → `expired` from any non-terminal phase.

**Secondary suite: guest session tokens**

- Mint guest JWT → verify → claims present.
- Upgrade → re-issue contains wallet + original `guestId`.
- WebSocket auth adapter rejects expired guest tokens.

**Not unit-tested in v1 (manual milestone checks, same as Challenge integration)**

- Full lobby teleport + overlay rendering.
- QR scan on a physical phone.
- Kickoff Countdown visuals after Start Match.
- Spectate portal appearing in host origin social room.

Gates: `npm run build`, `npm test -w server`.

## Out of Scope

- **Direct Invite** for activities other than a World Cup **Match** (API should not block
  future activities, but only Match is implemented).
- Replacing or removing the **Challenge** bubble flow.
- Guest access to the hub chamber, Free Play Field, room builder, payouts, or admin surfaces.
- Requiring wallet creation or Hub onboarding to finish a guest **Match**.
- Shareable lobby where multiple guests compete for admission (host pick).
- Rematch button, directed named challenges, or matchmaking queue.
- Persisting or resuming a **Direct Invite** or guest session across server restart (acceptable
  to fail closed: invite expired, please recreate).
- Legal/consent flow changes beyond what existing wallet login already requires when a guest
  chooses to sign in.
- In-match guest→wallet conversion (upgrade is splash/lobby only in v1).
- Localization of splash/lobby copy (English first).

## Further Notes

- Grill outcomes captured in
  [`.scratch/post-prod/issues/05-guest-invite-system.md`](../.scratch/post-prod/issues/05-guest-invite-system.md).
- Split implementation into tracked issues after this PRD (auth/HTTP, reducer+store, lobby
  room + WS, client splash, client lobby + Games Wheel, docs/ADR).
- Update `docs/features-checklist.md`, `server/.env.example`, and audience patch notes
  (CFD) when user-visible.
- Threat-model guests in the ADR: invite slug entropy, reclaim cookie/`guestId` binding,
  rate limits on redeem, no wallet→treasury paths on guest sessions.
- Deprecation: delete `server/src/directInvite/`, client invite UI, and `rooms.ts` hook
  blocks; guest JWT branch in auth can remain harmless or be removed with the feature.
