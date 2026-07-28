# Unlock Pad replaces tutorial Gate; per-wallet paid crossing

We introduce **Unlock Pad**: a placed obstacle that is solid for a wallet until that wallet
pays. Unlock lasts for the life of that placed instance (durable **Unlock Pad Grant**).
Admins configure amount, recipient, button label, and proof mode. The Unlock control is a
world-anchored orange button when the player is adjacent. After unlock, that wallet gets a
walkable crossing — see
[0012-unlock-pad-crossing-only.md](0012-unlock-pad-crossing-only.md) (supersedes
[0010-unlock-aftermath-teleporter.md](0010-unlock-aftermath-teleporter.md)’s Teleporter
Aftermath / “pad becomes the exit” rule).

**Proof is split:** the **Tutorial Room** keeps **Tutorial Unlock Ack** (optimistic after a
free **message sign** in Nimiq Pay / Hub — no spend, no on-chain verify on the critical path)
so first-contact stays fast and does not depend on faucet NIM being spendable yet — this
revisits [0005-tutorial-first-contact.md](0005-tutorial-first-contact.md)’s “do not bolt
Payment Intent onto the gate” rule by *replacing the Gate* with Unlock Pad while keeping
optimistic proof for tutorial only. Elsewhere, default proof is **Payment Intent** verify
(real spend).

In the tutorial, Unlock Pad **replaces** the Gate on the **Tutorial Path** Pay band.
**Tutorial Escape** unsticks the learner’s pad unlock; Exit / lesson complete is decided in
[0012-unlock-pad-crossing-only.md](0012-unlock-pad-crossing-only.md).

**Considered options:** room-global unlock after anyone pays — breaks concurrent tutorial
learners; Payment Intent for tutorial too — safer money, slower lesson; Gate + Unlock Pad
together — two Pay metaphors; above-head pill only — weaker “locked tile” signal; tutorial
real spend — fails when faucet balance is zero or still settling in Pay after mine.

Future readers should not reintroduce a tutorial Gate for Pay, or force Payment Intent / a
real NIM send onto the tutorial Unlock Pad path, without revisiting this ADR.
