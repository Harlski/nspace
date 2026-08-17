---
Type: research
Status: resolved
Blocked by:
---

# Catalog full-state vs delta vs path-order sends

## Question

Which server paths send room-wide full `state`, which send `stateDelta`, which send `moveOrder` / `moveAbort`, and how does occupied-room social traffic (typing, pay intent, challenge) change bytes compared to an empty room? Cite `rooms.ts` call sites.

## Answer

**Full `state` (`broadcastRoomStateFull`):** same-room teleport; World Cup kickoff / match begin / countdown room; stale challenge sweep; `nimSendIntent`; `chatTyping`; `setChallenge`; chat send when typing was on; field `setCountry`; profile rename. Each clones the whole roster including pose, cosmetics, `recentAliases`.

**Tick:** `stateDelta` of changed players, or full `state` if roster set changed / everyone changed / delta disabled. `CUT_MOVEMENT_STREAM` drops pose-only walkers, so a walking-only room often sends nothing.

**Already one-player `stateDelta`:** achievement level-up. Typing should match that.

**`moveOrder` / `moveAbort`:** walk start / path cut. Room-wide, not spatially filtered.

Empty room ≈ Path Playback only. Occupied room ≈ full `state` tax that is also the rewind trigger. Details: [../ANALYSIS.md](../ANALYSIS.md).
