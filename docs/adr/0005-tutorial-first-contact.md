# Nimiq Pay first-contact tutorial

First-time **Nimiq Pay** mini-app sessions route into a shared **Tutorial Room** before the
**Hub**. Each wallet gets its own **Tutorial Mine Slot** and gate state inside that room; web
and Hub wallet sessions skip the lesson.

**Receive** uses the normal hold-to-claim mine interaction with a fixed faucet payout (0.01
NIM). **Send** uses Nimiq Pay with **Tutorial Pay Ack**: the gate opens when Pay reports send
success, without on-chain verification on the critical path. If Pay hangs, **Tutorial Escape**
unsticks the gate and sends the player to the Hub without marking completion.

Completing the lesson means walking through the gate exit door into the **Hub**, which sets
`tutorialCompletedAt` and unlocks **First NIM**. After completion, the Tutorial Room is
reachable only via an admin-placed **Teleporter** (**Tutorial Sandbox** - layout only, no
payouts or lesson chrome).

Lesson chrome includes a **Tutorial Step Coach**: a persistent Mine → Pay → Exit strip under
the top HUD with a one-line next hint. Escape counts as completing Pay so the coach can advance
to Exit. Mining a block that is not the learner's **Tutorial Mine Slot** is a redirect
("Click and hold your glowing block.") plus a coach pulse on Mine - not a permission lecture.

Room layout is authored in **Tutorial Staging** and published as a **Tutorial Template**,
mirroring Play Space Template workflow. Spatial shape of that layout (portrait **Tutorial
Path**) is decided in [0006-tutorial-room-portrait-path.md](0006-tutorial-room-portrait-path.md).
Tutorial profile state, HTTP door APIs, and `welcome.tutorial` live in one server module
(**tutorial session service**).

Future readers should treat optimistic Pay ack as intentional for v1 speed; do not bolt Payment
Intent verification onto the gate-open path without revisiting this ADR.
