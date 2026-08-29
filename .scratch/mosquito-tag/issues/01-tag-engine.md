# 01 — Tag engine

**What to build:** From idle, a Caller can raise a Tag Call, others Join up to 8, the Caller Starts at 2+, countdown assigns a random Holder, walking beside a Participant passes the Mosquito with cooldown and previous-Holder immunity, Boost Pads speed the Holder, the timer Stings the Holder, leave/reassign and last-Participant win work. All of that is visible through `reduceTag` with no sockets.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [x] Idle → raise → calling with Caller in the party
- [x] Join, Leave, Cancel, Start (min 2, max 8, party locks)
- [x] Countdown → random Holder + Boost Pads from supplied walkable tiles
- [x] Pass on Chebyshev ≤ 1 with cooldown and previous-Holder immunity; Bystanders ignored
- [x] Holder on a live Boost Pad gets a 3s non-stacking boost; pad cools down
- [x] Timer end Stings the Holder; result then idle
- [x] Holder leave reassigns; last remaining Participant wins
