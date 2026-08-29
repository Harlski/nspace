# 02 — Room adapter

**What to build:** In an allowed social room, WebSocket Tag intents drive the engine, a `mosquitoTag` snapshot is broadcast (and included on welcome), Participants cannot walk during Tag Countdown, the Holder's Path Playback uses boost speed, Tag and soccer Challenge stay exclusive per player, and leaving the room clears Caller/Joiner/Participant as specified.

**Blocked by:** 01 — Tag engine

**Status:** ready-for-agent

- [x] `mosquitoTag` client action and server snapshot on the wire and welcome
- [x] Room policy: no Match Pitch, Field, Tutorial, Pixel, Canvas
- [x] One Tag Call or Tag Round per room; stream observers and invisible admins denied
- [x] Countdown rejects Participant `moveTo`; Bystanders walk
- [x] Boost restamps in-flight `moveOrder` from current pose
- [x] Challenge raise/accept refused while in Tag; Tag refused while Challenge/Match busy
- [x] Leave/disconnect/room change matches the spec
