# Nimiq Pay first-contact tutorial

First-time **Nimiq Pay** mini-app sessions route into a shared **Tutorial Room** before the
**Hub**. Each wallet gets its own **Tutorial Mine Slot** and **Unlock Pad** state inside that
room; web and Hub wallet sessions skip the lesson.

**Receive** uses the normal hold-to-claim mine interaction with a fixed faucet payout (0.01
NIM). **Send** uses Nimiq Pay with **Tutorial Pay Ack**: the Unlock Pad becomes walkable for
that wallet when Pay reports send success, without on-chain verification on the critical path.
If Pay hangs, **Tutorial Escape** unsticks the pad and sends the player to the Hub without
marking completion.

Completing the lesson means walking the unlocked path and through the Hub exit north of the
pad, which sets `tutorialCompletedAt` and unlocks **First NIM**. After completion, the Tutorial
Room is reachable only via an admin-placed **Teleporter** (**Tutorial Sandbox** - layout only,
no payouts or lesson chrome).

Lesson chrome includes a **Tutorial Step Coach**: a persistent Mine → Pay → Exit strip under
the top HUD with a one-line next hint. Escape counts as completing Pay so the coach can advance
to Exit. Mining a block that is not the learner's **Tutorial Mine Slot** is a redirect
("Click and hold your glowing block.") plus a coach pulse on Mine - not a permission lecture.

Room layout is authored in **Tutorial Staging** and published as a **Tutorial Template**,
mirroring Play Space Template workflow. Spatial shape of that layout (portrait **Tutorial
Path**) is decided in [0006-tutorial-room-portrait-path.md](0006-tutorial-room-portrait-path.md).
Pay crossing uses **Unlock Pad** per
[0007-unlock-pad.md](0007-unlock-pad.md). Tutorial profile state, HTTP door APIs, and
`welcome.tutorial` live in one server module (**tutorial session service**).

Future readers should treat optimistic Pay ack as intentional for v1 tutorial speed; do not
require Payment Intent verification on the tutorial Unlock Pad path without revisiting
[0007-unlock-pad.md](0007-unlock-pad.md).
