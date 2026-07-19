---
title: Unlock Pad
status: ready-for-agent
glossary: CONTEXT.md
adrs:
  - docs/adr/0007-unlock-pad.md
  - docs/adr/0008-unlock-pad-settings-dialog.md
  - docs/adr/0005-tutorial-first-contact.md
  - docs/adr/0006-tutorial-room-portrait-path.md
depends_on_grill: CONTEXT.md (Unlock Pad, Unlock Pad Settings, Tutorial Path, Tutorial Pay Ack, Tutorial Escape)
---

# Unlock Pad

> Vocabulary follows [CONTEXT.md](../CONTEXT.md): **Unlock Pad**, **Tutorial Room**,
> **Tutorial Path**, **Tutorial Pay Ack**, **Tutorial Escape**, **Tutorial Step Coach**,
> **Tutorial Template**, **Hub**, **Teleporter**, **Payment Intent Service**, **Build Shell**.

## Problem Statement

The tutorial Pay step uses a **Gate** that opens after payment. That metaphor is awkward for
“walk across once you’ve paid,” and the Unlock control was tied to gate ACL / above-head
portal pills rather than a clear locked crossing in the world.

Operators also want a **reusable** paid crossing they can place in other rooms (admin-only for
now): a visible locked block with an Unlock button, configurable price and proof mode — not a
tutorial-only hack.

## Solution

Add **Unlock Pad**: a placed obstacle that is solid for a wallet until that wallet unlocks it
by payment, then walkable for that wallet only. Unlock lasts for the life of that placed
instance. After unlock, the unlocker sees a distinct passable plate; others still see the
locked solid pad.

**Proof is split** ([ADR 0007](adr/0007-unlock-pad.md)):

- **Tutorial Room:** **Tutorial Pay Ack** (optimistic Nimiq Pay send success) for speed
- **Elsewhere:** **Payment Intent** verify by default

Admins place and configure Unlock Pads (amount, recipient, button label, proof mode). The
Unlock control is a **world-anchored button above the pad** when the player is orthogonally
adjacent.

In the tutorial, Unlock Pad **replaces** the Gate on the **Tutorial Path** Pay band. Unlock
only clears the path; a separate Hub exit north of the pad remains the Exit beat. **Tutorial
Escape** unsticks the learner’s pad unlock if Pay hangs.

## User Stories

### Learner — Unlock Pad in the Tutorial Room

1. As a tutorial learner who finished mining, I want to see a locked **Unlock Pad** on the
   Tutorial Path, so that I know where payment unlocks the crossing.
2. As a tutorial learner standing beside the pad, I want a world-anchored Unlock button above
   the pad (using the configured label), so that I can start payment without hunting a Gate.
3. As a tutorial learner, I want tapping Unlock to open Nimiq Pay with the tutorial door quote
   (**Tutorial Pay Ack**), so that the lesson stays fast without on-chain wait.
4. As a tutorial learner, when Pay reports send success, I want the pad to become walkable for
   me only, so that I can cross while others still see it locked.
5. As a tutorial learner, after I unlock, I want the pad to look like an open plate for me (not
   vanish), so that I can tell I paid for that crossing.
6. As a tutorial learner, I want a separate Hub exit north of the pad, so that Exit stays a
   distinct coach step after Pay.
7. As a tutorial learner, if Pay hangs, I want **Tutorial Escape** to unstick my Unlock Pad and
   send me to the Hub without completing the lesson, so that I am not stuck forever.
8. As a concurrent learner in the same Tutorial Room, I want my unlock not to open the pad for
   others, so that each wallet still pays their own lesson.
9. As a tutorial learner in **Tutorial Sandbox**, I want no Unlock payment chrome on pads, so
   that revisit is layout-only.
10. As a tutorial learner, I want the **Tutorial Step Coach** Pay hint to tell me to unlock the
    pad (not double-click a gate), so that copy matches the world.

### Player — Unlock Pad outside tutorial

11. As a player next to an admin-placed Unlock Pad with proof mode payment_intent, I want
    tapping Unlock to create a Payment Intent and open **Nimiq Pay** (mini-app) or **Nimiq Hub**
    checkout (browser) with the memo, so that unlock is real on-chain spend.
12. As a player who completed Payment Intent verify for a pad, I want that pad walkable for my
    wallet forever on that instance, so that reconnect does not charge me again.
13. As a player who has not unlocked a pad, I want pathfinding and walking to treat it as solid,
    so that I cannot clip through without paying.
14. As a player who unlocked a pad, I want to walk across it while another player on the same
    tile still cannot, so that per-wallet collision is authoritative.
15. As a player, I want the Unlock button hidden when I already unlocked that instance, so that
    I am not offered a useless pay again.
16. As a player, I want the Unlock button hidden when I am not adjacent, so that distant pads
    do not spam UI.
17. As a player, if Payment Intent sync fails, I want a clear status and a way to retry Unlock,
    so that a flaky verify does not soft-lock me with no feedback.

### Admin — place and configure

18. As a game admin in build mode, I want to place an Unlock Pad like other special blocks, so
    that I can author paid crossings without code changes.
19. As a game admin, I want to set amount (NIM), recipient wallet, button label, and proof mode
    via **Unlock Pad Settings** (dock summary + Edit → Save/Cancel dialog), so that each
    crossing can be priced and labeled without using the cramped Parameters column.
20. As a game admin, I want tutorial template pads to force or default to optimistic proof, so
    that first-contact cannot accidentally require Payment Intent.
21. As a game admin, I want non-admins unable to place or edit Unlock Pad props, so that paid
    crossings stay operator-controlled in v1.
22. As a game admin, when I delete or replace an Unlock Pad instance, I want prior unlocks for
    that instance to stop applying, so that a new pad is a fresh purchase.
23. As a game admin publishing a **Tutorial Template**, I want the bootstrap / staging layout to
    use Unlock Pad on the Pay band instead of a Gate, so that fresh deploys match ADR 0007.
24. As a game admin, I want existing Gate ACL tools unchanged for real Gates elsewhere, so that
    Unlock Pad does not break Hub/Commons gate workflows.

### System / authority

25. As the server, I want movement validation to consult per-wallet Unlock Pad state, so that
    clients cannot spoof walkability.
26. As the server, I want unlock grants keyed by wallet + room + block instance, so that
    forever-per-instance lifetime is durable across reconnects.
27. As the server, I want optimistic tutorial unlock to be idempotent on door-sent / unstick, so
    that retries do not corrupt session state.
28. As the Payment Intent Service, I want a feature kind for Unlock Pad fulfill that grants the
    unlock idempotently, so that double-sync cannot double-charge semantics.
29. As the client, I want obstacle snapshots to include enough Unlock Pad config for the Unlock
    button (label, locked-for-me), so that the world-anchored control can render without a
    separate poll when adjacent.
30. As an operator, I want docs and patch notes to describe Unlock Pad and the tutorial Gate
    replacement, so that deployers know to republish tutorial templates if needed.

## Implementation Decisions

- Respect ADRs **0005**, **0006**, **0007** and glossary terms in CONTEXT.md.
- Introduce a deep **Unlock Pad domain module** on the server as the primary seam: walkability
  for wallet W, record unlock, quote/fulfill by proof mode. Room movement and HTTP/WS adapters
  call into it rather than scattering pad logic.
- Store Unlock Pad config on placed obstacle props (amount, recipient, button label, proof mode).
  Placement and prop edit: **admin only** in v1.
- Persist per-wallet unlock grants keyed by wallet + room id + block instance key; survive
  reconnect; invalidate when that instance is removed.
- Movement authority: treat pad as solid for wallets without a grant; passable for wallets with
  a grant (same authority layer as today’s walk checks / gate open patterns).
- Client: world-anchored Unlock control above the pad when orthogonally adjacent and locked for
  self; hide when unlocked, not adjacent, or tutorial sandbox / non-lesson.
- Tutorial: replace Gate in Tutorial Template bootstrap and Pay flow with Unlock Pad; keep
  separate Hub exit north of the pad; retarget Tutorial Escape / door-sent / coach copy from
  gate to pad; remove tutorial-only Unlock Gate portal-pill path once pad UI works.
- Proof split: tutorial path keeps existing optimistic door-quote / door-sent style APIs (or
  thin rename) wired to Unlock Pad grants; non-tutorial default uses Payment Intent create +
  sync + new feature kind fulfill (prior art: cosmetic unlock).
- Visual: locked solid look for non-unlockers; distinct passable plate for unlockers (client
  presentation from grant state, not a global prop flip).
- Build Shell / Tutorial Template must round-trip Unlock Pad props like other special blocks.
- Do not remove the general Gate feature from the game; only stop using it for tutorial Pay.

## Testing Decisions

### What makes a good test

Assert **external behavior** through public module/HTTP/WS contracts: walkability for a wallet,
grant presence, quote/fulfill outcomes, welcome/session fields. Do not assert Three.js meshes,
CSS, or internal map mutation order.

### Primary seam — Unlock Pad domain module

| Behavior | Assertion |
|----------|-----------|
| Locked walkability | wallet without grant cannot walk onto pad tile |
| Unlocked walkability | same wallet after grant can; other wallet still cannot |
| Record unlock | idempotent second grant |
| Instance delete | grant for removed block key no longer opens a new pad at same coords unless re-granted |
| Proof mode routing | optimistic vs payment_intent paths invoked as configured |

Prior art: gate open / walk tests, `tutorialSessionService` tests, block claim access tests.

### Room movement authority

Path or step into pad tile rejected without grant; accepted with grant. Prior art: room
walkability / move validation tests.

### Tutorial Pay path

door-quote / door-sent / unstick grant Unlock Pad for wallet; Escape does not set
`tutorialCompletedAt`; coach/session lastStep advances. Prior art: `tutorialSessionService`
and tutorial HTTP tests.

### Payment Intent path

Intent create + fulfill grants unlock; second sync idempotent. Prior art: cosmetic unlock
intent/fulfill tests; payment-intent feature handler tests.

### Client helpers (light)

Adjacent + locked → offer Unlock; unlocked or sandbox → no offer. Prior art:
`client/src/tutorial/flow.test.ts` (retarget from Unlock Gate).

Avoid E2E Nimiq Pay / full Payment Intent chain in CI; manual acceptance for Pay mini-app
mine → Unlock Pad → Hub exit.

## Out of Scope

- Non-admin placement or player-authored Unlock Pads
- Room-global unlock (one payment opens for everyone)
- Timed / expiring unlocks
- Multi-tile bridge as a single purchase
- Unlock Pad that also teleports or auto-completes the tutorial
- Forcing Payment Intent on the tutorial Unlock Pad path
- Removing Gates from the game entirely
- Web/Hub wallet tutorial Pay (Pay mini-app lesson path unchanged in audience)
- Guest wallets unlocking pads

## Further Notes

- Grilling locked decisions; ADR 0007 is normative for proof split and tutorial Gate replacement.
- Existing deploys with a persisted Tutorial Template still need staging republish after
  bootstrap changes, same as the portrait path rollout.
- Prefer one Unlock Pad domain module over parallel “tutorial gate state” and “paid tile state”
  stores long term; migrate tutorial doorPaidAt semantics onto pad grants where practical.
