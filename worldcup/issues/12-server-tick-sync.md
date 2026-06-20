---
id: "12-server-tick-sync"
milestone: M1
depends_on: ["11-field-room"]
status: todo
acceptance:
  - rooms.ts tick simulates balls per room via worldcup module (flag-gated, one call)
  - Proximity kick from player position + heading imparts velocity (with cooldown)
  - ballState broadcast is throttled (BALL_STATE_BROADCAST_MIN_MS) and only when moving/changed
  - welcome includes the room's balls
  - OutMsg union gains ballState (and goalScored, used in M2)
verify:
  - "npm run build"
  - "Manual: two clients in field see the ball move when one walks into it"
---

# 12 — Server tick + sync

Wire the pure physics into the authoritative tick. Keep the hook to a single
`tickRoomBalls(roomId, room, dt, now)` call inside the existing room loop, returning
whether to broadcast. No new client intent for kicking — the server detects
player/ball proximity from positions it already has.
