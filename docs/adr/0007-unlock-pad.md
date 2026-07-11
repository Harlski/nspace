# Unlock Pad replaces tutorial Gate; per-wallet paid crossing

We introduce **Unlock Pad**: a placed obstacle that is solid for a wallet until that wallet
pays, then walkable for that wallet only. Unlock lasts for the life of that placed instance.
Admins configure amount, recipient, button label, and proof mode. The Unlock control is a
world-anchored button above the pad when the player is adjacent. After unlock, unlockers see
a distinct passable plate; others still see the locked solid pad.

**Proof is split:** the **Tutorial Room** keeps **Tutorial Pay Ack** (optimistic Nimiq Pay
send success, no on-chain verify on the critical path) so first-contact stays fast — this
revisits [0005-tutorial-first-contact.md](0005-tutorial-first-contact.md)’s “do not bolt
Payment Intent onto the gate” rule by *replacing the Gate* with Unlock Pad while keeping
optimistic proof for tutorial only. Elsewhere, default proof is **Payment Intent** verify.

In the tutorial, Unlock Pad **replaces** the Gate on the **Tutorial Path** Pay band. Unlock
only clears the path; a separate Hub exit north of the pad remains the Exit beat. **Tutorial
Escape** unsticks the learner’s pad unlock (same escape semantics as today’s gate unstick).

**Considered options:** room-global unlock after anyone pays — breaks concurrent tutorial
learners; Payment Intent for tutorial too — safer money, slower lesson; Gate + Unlock Pad
together — two Pay metaphors; above-head pill only — weaker “locked tile” signal.

Future readers should not reintroduce a tutorial Gate for Pay, or force Payment Intent onto
the tutorial Unlock Pad path, without revisiting this ADR.
