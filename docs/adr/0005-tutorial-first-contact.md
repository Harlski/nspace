# Nimiq Pay first-contact tutorial

First-time **Nimiq Pay** mini-app sessions route into a shared **Tutorial Room** before the
**Hub**. Each wallet gets its own **Tutorial Mine Slot** and **Unlock Pad** state inside that
room; web and Hub wallet sessions skip the lesson.

**Receive** uses the normal hold-to-claim mine interaction with a fixed faucet payout (0.01
NIM). **Send** uses Nimiq Pay with **Tutorial Pay Ack**: the pad unlocks for that wallet when
Pay reports send success, without on-chain verification on the critical path. Tutorial Path
Pay uses **Unlock Aftermath** = crossing; Exit is a separate authored **Exit Teleporter**
north of the pad — see
[0012-unlock-pad-crossing-only.md](0012-unlock-pad-crossing-only.md) (supersedes
[0010-unlock-aftermath-teleporter.md](0010-unlock-aftermath-teleporter.md)). If Pay hangs,
**Tutorial Escape** grants pad unlock and sends the player to the Hub without marking
completion.

Completing the lesson means **Enter**ing the path's Exit Teleporter to the Hub, which sets
`tutorialCompletedAt` and unlocks **First NIM**. After completion, the Tutorial Room is
reachable only via an admin-placed **Teleporter** (**Tutorial Sandbox** - no faucet payouts;
the Step Coach still shows progress).

Lesson chrome includes a **Tutorial Step Coach**: a persistent Mine → Pay → Exit strip under
the top HUD with a one-line next hint. The coach stays visible for **Tutorial Sandbox**
teleporter revisits so learners still see their progress. Escape counts as completing Pay so
the coach can advance to Exit. A **client-local Attention Marker** (not the shared room
marker layer) tracks the coach target: **every gold (claimable) mine** on Mine, **every Unlock
Pad** on Pay, then the **Exit Teleporter** on Exit. Mining a gold block completes Step 1
(any claimable block in the Tutorial Room); _wrong-slot_ redirects are no longer used for
Step 1.

Room layout is authored in **Tutorial Staging** and published as a **Tutorial Template**,
mirroring Play Space Template workflow. Spatial shape of that layout (portrait **Tutorial
Path**) is decided in [0006-tutorial-room-portrait-path.md](0006-tutorial-room-portrait-path.md).
Pay crossing uses **Unlock Pad** per
[0007-unlock-pad.md](0007-unlock-pad.md) and
[0012-unlock-pad-crossing-only.md](0012-unlock-pad-crossing-only.md). Tutorial profile
state, HTTP door APIs, and `welcome.tutorial` live in one server module (**tutorial session
service**).

Future readers should treat optimistic Pay ack as intentional for v1 tutorial speed; do not
require Payment Intent verification on the tutorial Unlock Pad path without revisiting
[0007-unlock-pad.md](0007-unlock-pad.md). Do not put Teleporter Aftermath back on the Unlock
Pad, or treat Pay ack as lesson complete, without revisiting
[0012-unlock-pad-crossing-only.md](0012-unlock-pad-crossing-only.md).
