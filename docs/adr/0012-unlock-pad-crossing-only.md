---
status: accepted
supersedes: 0010-unlock-aftermath-teleporter
---

# Unlock Aftermath is always a per-wallet crossing

**Unlock Pad** is a paid metaphorical gate: solid until that wallet pays, then a walkable
**crossing** for that wallet only via a durable **Unlock Pad Grant**. It never becomes a
Teleporter. Exits are separate placed **Teleporter**s beyond the pad. Concurrent learners
each keep their own grant; grants survive leave/rejoin until Tutorial Reset (tutorial) or
pad/room removal.

This **supersedes** [0010-unlock-aftermath-teleporter.md](0010-unlock-aftermath-teleporter.md)
(“pad becomes the exit” / Teleporter Aftermath). The **Tutorial Path** is Mine → Pay
(Unlock Pad crossing) → Exit (**Exit Teleporter** authored north of the pad). Lesson
complete is **Enter**ing that Exit Teleporter (Pay ack alone is not enough). **Tutorial
Escape** still grants unlock and forces Hub without completion. Step Coach Exit Attention
Markers point at the Exit Teleporter. Unlock Pad Settings no longer configure Aftermath;
placement ACL stays as today (player-room placement is a later product pass).

**Considered options:** keep Teleporter Aftermath as a pad option — two metaphors and the
pad-swap bugs; room-global unlock after first pay — breaks concurrent Tutorial Room
learners; session-only grant — contradicts “they paid, it stays open”; Exit Teleporter on
the pad tile — collapses Pay and Exit again.

Future readers should not reintroduce Teleporter Aftermath on Unlock Pad, or treat Pay ack
as lesson complete, without revisiting this ADR. Proof split remains
[0007-unlock-pad.md](0007-unlock-pad.md).
