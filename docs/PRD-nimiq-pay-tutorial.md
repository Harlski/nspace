---
title: Nimiq Pay First-Contact Tutorial
status: ready-for-agent
glossary: CONTEXT.md
adrs:
  - docs/adr/000N-tutorial-first-contact.md
depends_on_grill: CONTEXT.md (Tutorial Room, Tutorial Staging, Tutorial Template, Tutorial Mine Slot, Tutorial Pay Ack, Tutorial Escape, Tutorial Sandbox)
---

# Nimiq Pay First-Contact Tutorial

> Vocabulary follows [CONTEXT.md](../CONTEXT.md): **Tutorial Room**, **Tutorial Staging**,
> **Tutorial Template**, **Tutorial Mine Slot**, **Tutorial Pay Ack**, **Tutorial Escape**,
> **Tutorial Sandbox**, **Hub**, **Player Menu**, **Payout Service**, **Teleporter**,
> **Achievement Unlock Banner**.

## Problem Statement

Nimiq Space today sends every new wallet player straight into the **Hub** after sign-in.
There is no guided moment that teaches the two core Nimiq loops the product depends on:
**receiving NIM** (mining claimable blocks) and **sending NIM** (wallet payment). First-time
players in the **Nimiq Pay** mini-app especially lack a fast, trustworthy on-ramp before
they enter social space.

The existing Getting Started achievement track assumes Hub exploration; it does not deliver
a sub-minute receive-and-send demo. Slow or stuck on-chain verification would ruin immersion
for a feature whose whole point is emphasizing Nimiq speed.

Operators also cannot author or iterate the tutorial layout without code changes.

## Solution

Add a **mandatory-once** first-contact flow for **Nimiq Pay mini-app** sessions only:

1. After wallet sign-in, route the player into a shared **Tutorial Room** (not the Hub).
2. In that room, mine a **Tutorial Mine Slot** assigned to their wallet for a fixed **0.01 NIM**
   faucet payout (via the existing **Payout Service**).
3. Send **0.01 NIM** back through Nimiq Pay to unlock an exit gate (**Tutorial Pay Ack** —
   optimistic unlock on Pay send success, no on-chain verify for v1).
4. Walk through the exit into the **Hub** with a short welcome transition, deferred username
   prompt, and a **First NIM** onboarding achievement.

The room layout is built in **Tutorial Staging** by admins and allowlisted builders, then
**published** as a **Tutorial Template** that seeds the live Tutorial Room (mirroring Play
Space Template authoring).

**Per-wallet progress** in a **shared room**: concurrent learners see each other's avatars
but each gets their own mine slot and gate state. Chat and emotes are suppressed during the
lesson.

If Nimiq Pay send hangs, a **Tutorial Escape** timer (10s, visible countdown last 5s) unsticks
the gate and sends the player to the Hub without completing the lesson; they can retry via
**Finish tutorial** in **Player Menu**.

After completion, the Tutorial Room is reachable only via an **admin-placed Teleporter**
(**Tutorial Sandbox** revisit — layout only, no lesson or payouts).

## User Stories

### Nimiq Pay first-time player — entry and identity

1. As a first-time **Nimiq Pay** player opening Nimiq Space, I want to sign in with my wallet
   and enter the **Tutorial Room** automatically, so that I learn NIM basics before the Hub.
2. As a first-time Pay player, I want a brief non-blocking toast ("Signed in with your Nimiq
   wallet" plus identicon and truncated address) on tutorial entry, so that I feel my identity
   is confirmed without an extra blocking screen.
3. As a first-time Pay player, I want the **username prompt deferred** until I reach the Hub
   after completing or abandoning the tutorial, so that nothing slows the ~60-second lesson.
4. As a **web or Hub wallet** player (non-Pay), I want to skip the tutorial and enter the Hub
   as today, so that v1 scope stays focused on the mini-app path.
5. As a returning Pay player who already completed the tutorial, I want to go straight to the
   Hub on sign-in, so that I am not forced through the lesson again.

### Nimiq Pay first-time player — mine (receive NIM)

6. As a tutorial learner, I want to see a guided highlight on **my** assigned **Tutorial Mine
   Slot**, so that I know which block to mine when others may be in the same room.
7. As a tutorial learner, I want to mine only my assigned slot (other slots appear inert to
   me), so that I never fight another player for the same block.
8. As a tutorial learner, I want mining to use the normal hold-to-claim interaction, so that
   the lesson matches real Hub mining.
9. As a tutorial learner, I want instant success feedback when my mine completes, so that
   receiving NIM feels immediate even though payout is async on-chain.
10. As a tutorial learner, I want to receive exactly **0.01 NIM** from the faucet mine, so that
    the amount is easy to understand and mirrors the door payment.
11. As the system, I want the faucet payout idempotent per wallet (`tutorial-mine-{wallet}`),
    so that retries or resume never double-pay.
12. As the system, I want tutorial faucet claims to succeed even when payout wallet balance
    peek would block normal mining, so that learners never see "Nothing here :(" in the lesson.

### Nimiq Pay first-time player — pay (send NIM)

13. As a tutorial learner who finished mining, I want a clear prompt to pay to unlock the exit
    gate, so that I understand sending NIM is the next step.
14. As a tutorial learner, I want a server-provided door quote (amount, recipient, memo) before
    Pay opens, so that the send uses correct parameters.
15. As a tutorial learner, I want Nimiq Pay to send **0.01 NIM** when I confirm, so that the
    send mirrors what I received.
16. As a tutorial learner, I want the gate to open **immediately** when Nimiq Pay reports send
    success (**Tutorial Pay Ack**), so that I experience Nimiq speed without waiting for
    on-chain confirmation.
17. As a tutorial learner who cancels the Pay sheet, I want to retry without an escape countdown,
    so that cancellation is not treated as a stall.
18. As the system, I want **door-sent** ack idempotent per wallet, so that duplicate client calls
    are safe.

### Nimiq Pay first-time player — complete and Hub transition

19. As a tutorial learner, I want to walk through the exit after the gate opens, so that
    completion feels like leaving a room not clicking a menu.
20. As a tutorial learner who completes the exit, I want a short fade and **Welcome to the Hub**
    banner, so that the transition into social space is smooth.
21. As a tutorial learner who completes the tutorial, I want to spawn at the normal Hub default
    spawn, so that I land where experienced players expect.
22. As a tutorial learner who completes the tutorial, I want the **First NIM** onboarding
    achievement and **Achievement Unlock Banner** on Hub arrival, so that completion feels
    rewarding.
23. As a tutorial learner who completes the tutorial, I want the deferred **username prompt**
    after Hub arrival, so that I can set my display name before exploring.

### Nimiq Pay first-time player — stuck and retry

24. As a tutorial learner whose Nimiq Pay send **hangs**, I want a silent wait then a visible
    5-second countdown, so that I know something is wrong before I am rescued.
25. As a tutorial learner whose escape timer fires, I want the message "Tutorial is broken.
    Bet you have never heard that before :sweatsmile:." and teleport to the Hub, so that I
    am never trapped.
26. As a tutorial learner who escaped via **Tutorial Escape**, I want the tutorial marked
    **incomplete**, so that I can finish properly later.
27. As an incomplete Pay player, I want **Finish tutorial** in **Player Menu**, so that I can
    re-enter the Tutorial Room from the Hub.
28. As an incomplete Pay player returning via **Finish tutorial**, I want to **resume** at my
    last step (mine done → straight to gate; no second faucet payout), so that retry is fair.
29. As the system, I want **unstick** to open the gate server-side when escape fires, so that
    stale client state does not block retry.

### Social presence during lesson

30. As a tutorial learner, I want to **see other players' avatars** in the shared Tutorial Room,
    so that the space feels alive.
31. As a tutorial learner, I want **chat and emotes suppressed** during the lesson, so that I
    am not distracted during the short demo.
32. As a tutorial learner who completes or abandons, I want normal chat and emotes in the Hub,
    so that social rules match the rest of Nimiq Space.

### Post-complete revisit (Tutorial Sandbox)

33. As a player who completed the tutorial, I want **no Finish tutorial** entry in **Player Menu**,
    so that the lesson does not appear as unfinished.
34. As a player who completed the tutorial, I want to revisit the Tutorial Room only through an
    **admin-placed Teleporter**, so that return is intentional and curated.
35. As a player revisiting via Teleporter after completion, I want **Tutorial Sandbox** behavior
    (walk the layout, no faucet, no door payment, no guided overlay, normal chat/emotes), so
    that revisit is exploratory not a repeat lesson.
36. As a non-admin player, I want to be **unable to set a Teleporter destination** to the
    Tutorial Room, so that only operators wire access.
37. As a player who completed the tutorial, I want the server to **block direct joinRoom** to
    the Tutorial Room, so that Player Menu shortcuts cannot bypass teleporter-only access.

### Admin and builder — authoring

38. As a **game admin**, I want a **Tutorial Staging** room to build the layout, so that I can
    iterate without affecting live learners.
39. As a **game admin** or **allowlisted builder**, I want to place **Tutorial Mine Slot**
    markers, an exit gate, spawn, and decor in Tutorial Staging, so that the published template
    has everything the lesson needs.
40. As a **game admin**, I want to **publish** Tutorial Staging into a **Tutorial Template**
    that seeds the live Tutorial Room, so that layout changes do not require deploys.
41. As a **game admin**, I want admin UI to sync from staging, preview, and set the default
    template (mirroring Play Space Template management), so that authoring is familiar.
42. As a **game admin**, I want Tutorial Staging to **not drain the live faucet** during
    testing, so that builder sessions are safe.
43. As a **game admin**, I want to join Tutorial Staging and the live Tutorial Room for ops,
    so that I can verify what players see.
44. As a **game admin**, I want to configure a **Teleporter** in the Hub (or elsewhere) whose
    destination is the Tutorial Room, so that post-complete sandbox visits are possible.

### Discovery and catalog

45. As any player, I want the Tutorial Room and Tutorial Staging **hidden from the Rooms browser**
    and **Home Wheel → My Rooms**, so that the tutorial is not confused with normal rooms.
46. As the system, I want first-time incomplete Pay sessions routed to the Tutorial Room with
    resume disabled, so that chamber reconnect logic does not skip the lesson.

### Concurrent learners

47. As two Pay players in the Tutorial Room at once, I want **distinct mine slot assignments**,
    so that we never block each other.
48. As two Pay players, I want **per-wallet gate state** (my payment opens my gate only), so
    that progress is independent in the shared room.

### Achievements and onboarding

49. As a player, I want **First NIM** in the onboarding category on first tutorial complete,
    so that it appears in Getting Started progress.
50. As the system, I want First NIM **not** required for Telescope capstone prerequisites,
    so that the Pay tutorial complements rather than replaces existing onboarding.

### Operators

51. As an operator, I want env flags to enable/disable the tutorial and configure amounts and
    builder allowlist, so that rollout is controllable.
52. As an operator, I want docs and patch notes updated when shipping, so that deploys are
    predictable.

## Implementation Decisions

### Primary module seam (single deep module)

Consolidate **tutorial profile state + HTTP tutorial API + welcome payload** in one server
module (working name: **tutorial session service**) that owns:

- **Profile fields** on the wallet row:
  - `tutorialCompletedAt` (ms epoch; absent = incomplete)
  - `tutorialAbandonedAt` (optional analytics)
  - `tutorialSession`: mine slot tile key, mine/door/unstick timestamps, last step enum
- **Routing gate**: `needsTutorial = sessionNimiqPay && !tutorialCompletedAt`
- **HTTP surface** (JWT, wallet-scoped):
  - `GET /api/tutorial/door-quote` → amount, recipient, memo
  - `POST /api/tutorial/door-sent` → optimistic **Tutorial Pay Ack**; sets `doorPaidAt`; opens
    gate for this wallet only; idempotent
  - `POST /api/tutorial/unstick` → opens gate for wallet; does not complete tutorial
  - `POST /api/tutorial/abandon` → sets `tutorialAbandonedAt`
- **WebSocket `welcome.tutorial` payload**: `needsTutorial`, `session`, `completedAt`, assigned
  `mineTile`, mode (`lesson` | `sandbox`)
- **joinRoom guards**: allow incomplete Pay + admins/builders; block completed Pay direct join
- **Completion handler**: exit door walk-through → set `tutorialCompletedAt` → achievement event

Room authority, block claim, and gate open call thin wrappers into this module rather than
embedding tutorial rules inline across handlers.

**Tutorial session shape** (decision-rich):

```typescript
type TutorialLastStep = "mine" | "pay" | "exit";

type TutorialSession = {
  mineSlotTile?: string;
  mineCompletedAt?: number;
  doorPaidAt?: number;
  gateUnstuckAt?: number;
  lastStep?: TutorialLastStep;
};

type TutorialWelcome = {
  needsTutorial: boolean;
  completedAt?: number;
  mode: "lesson" | "sandbox";
  session?: TutorialSession;
  mineTile?: string; // client highlight target
};
```

### Tutorial Template store (secondary seam)

Mirror Play Space Template pattern:

- Versioned JSON persistence for **Tutorial Template** records (Build Shell + metadata)
- **Tutorial Staging** room id for authoring; **Tutorial Room** runtime id seeded from
  published default template
- Export preserves **Tutorial Mine Slot** markers; runtime activates only the wallet's assigned slot
- Admin publish/sync/preview on admin rooms page

### Mine (receive) integration

- Tutorial Room block claim: only on assigned `mineSlotTile`; fixed 0.01 NIM
- Enqueue pay-intent via existing **Payout Service** gateway with idempotent claim id
- Bypass balance peek failure for tutorial claims

### Door (send) — optimistic Pay ack

- **No Payment Intent Service on critical path** for v1
- Client: quote → Nimiq Pay `sendBasicTransactionWithData` (retry pattern aligned with advertise
  checkout) → on resolve, `POST door-sent` with optional tx hash
- Server trusts Pay ack; no on-chain verify; optional background verify for metrics only
- Gate open is **per-wallet**, not global room state

### Teleporter destination policy

- Only **game admins** may set Teleporter destination to Tutorial Room when configuring
- Any player may **walk through** an admin-placed Teleporter into **Tutorial Sandbox**

### Client routing and UX

- Pay + `needsTutorial`: skip username gate until Hub; connect Tutorial Room with resume off
- **Lesson mode**: guided highlights; suppress chat send and emote wheel
- **Tutorial Escape** timer: armed only while Pay send promise pending; 10s total, countdown
  visible last 5s; on fire → unstick + abandon + join Hub + cheeky message
- **Player Menu**: **Finish tutorial** only when Pay + incomplete
- Hub transition: fade + welcome banner; then username prompt; achievement banner

### Achievement

- New onboarding achievement (display **First NIM**); unlock on first `tutorialCompletedAt`
- Not a Telescope prerequisite

### Configuration

| Variable | Role |
|----------|------|
| `TUTORIAL_ENABLED` | Master switch |
| `TUTORIAL_BUILDER_ALLOWLIST` | Wallets that may edit Tutorial Staging |
| `TUTORIAL_FAUCET_AMOUNT_LUNA` | Default 1_000_000 (0.01 NIM) |
| `TUTORIAL_DOOR_AMOUNT_LUNA` | Default 1_000_000 |
| `TUTORIAL_ESCAPE_MS` | Client; default 120000 (2 min) |
| `TUTORIAL_ESCAPE_COUNTDOWN_MS` | Client; default 10000 |

### ADR

- Document: shared room + per-wallet state, optimistic **Tutorial Pay Ack**, teleporter-only
  post-complete access, deferred username prompt — include matching `docs/reasons/reason_*.md`

## Testing Decisions

### Primary seam (confirmed)

**One primary seam:** **tutorial session service** — profile tutorial state + HTTP tutorial
APIs + `welcome.tutorial` payload.

Unit and integration tests should exercise this module's **observable contracts** without
depending on client UI or Nimiq Pay WebView:

| Behavior | Assertion |
|----------|-----------|
| `needsTutorial` | true for Pay wallet without `tutorialCompletedAt`; false for web; false after complete |
| Mine slot assignment | two wallets → distinct slots; stable on rejoin |
| Claim rejection | wallet cannot claim another wallet's slot tile |
| Faucet idempotency | second claim attempt rejected or no-op payout |
| `door-quote` | returns configured amount and memo for authenticated wallet |
| `door-sent` | sets `doorPaidAt`, marks gate passable for wallet; idempotent second call |
| `unstick` | opens gate without setting `tutorialCompletedAt` |
| `abandon` | sets `tutorialAbandonedAt`; tutorial still incomplete |
| Completion | exit door event → `tutorialCompletedAt` + achievement unlock |
| `joinRoom` guard | completed Pay wallet rejected for Tutorial Room direct join |
| `welcome.tutorial` | includes correct `mineTile`, `mode: sandbox` for complete teleporter entry |

Good tests assert **external behavior** (HTTP status, profile fields, welcome JSON, gate
passability for wallet), not internal map mutation order.

**Prior art:** player profile store tests, cosmetic unlock HTTP tests, block claim access tests,
Play Space template store tests, direct invite store tests.

### Secondary seams (minimal)

- **Tutorial Template store**: publish from staging updates runtime shell; mine slot markers preserved
- **Room catalog filter**: Tutorial Room ids absent from listRooms for clients
- **Teleporter destination**: admin allowed, non-admin denied for Tutorial Room target

### Client tests (light)

- Escape timer arms only during pending Pay send mock; cancels on resolve
- Finish tutorial hidden when `tutorialCompletedAt` set
- Lesson mode suppresses chat send (behavioral flag from welcome)

Avoid testing admin HTML directly; avoid E2E Nimiq Pay in CI (manual / payEmulate dev).

Manual acceptance: Nimiq Pay mini-app full path mine → pay → Hub under 60 seconds happy path.

## Out of Scope

- Web or Hub wallet send path for tutorial door payment (Pay only v1)
- On-chain door payment verification via Payment Intent Service on critical path
- Per-wallet private Tutorial Room instances (`tutorial-{wallet}`)
- Tutorial listed in Rooms browser or Home Wheel My Rooms
- **Finish tutorial** or direct join after completion (teleporter-only revisit)
- Replacing or merging into existing Getting Started achievement prerequisites for Telescope
- Real NIM replay on every sandbox revisit
- Player-authored Tutorial Templates
- Hard-delete Tutorial Templates (archive/publish pattern only if versioning added later)
- Guest sessions in tutorial (wallet required)

## Further Notes

- Grilling locked all major decisions; this PRD is the handoff artifact for `/to-issues` or
  `/implement` without re-interviewing the user.
- **Hub** in player-facing copy maps to chamber room id; glossary uses **Hub** consistently.
- Symmetric 0.01 NIM mine and door keeps the mental model simple; net ~zero before chain fees.
- **Tutorial Escape** is narrowly scoped to Pay send hang — mining hold and post-send instant
  ack are intentionally excluded.
- Update CONTEXT.md glossary, features-checklist, process env docs, and UNRELEASED patch notes
  when shipping.
- Suggested implementation order: tutorial session service + profile → template store + staging
  → runtime room + mine faucet → door ack APIs → client routing/guided flow/escape → admin UI →
  docs/ADR.
