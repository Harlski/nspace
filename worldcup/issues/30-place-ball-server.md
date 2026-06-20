---
id: "30-place-ball-server"
milestone: M3
depends_on: ["12-server-tick-sync"]
status: done
acceptance:
  - placeBall / removeBall WS handlers (flag-gated)
  - placeBall requires build permission in the room (canEditRoomContent) + per-room cap
  - Placed balls persist (definitions) and simulate like the field ball, but score nothing
  - Balls outside the field room never contribute to the tally
verify:
  - "npm run build"
  - "Manual: place a ball in the hub and kick it; no goals are tallied there"
---

# 30 — Place a ball anywhere (server)

Allow builders to drop a kickable ball in any room. Reuses the same physics/sync; goal
detection stays field-only. Placed balls obey `MAX_PLACED_BALLS_PER_ROOM`.
