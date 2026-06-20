---
id: "11-field-room"
milestone: M1
depends_on: ["10-ball-physics"]
status: todo
acceptance:
  - Field room registered server-side (bounds, doors, hasRoom) only when WORLDCUP_ENABLED
  - Hub gains a west-edge door to the field; field has a door back to the hub
  - server/src/worldcup/ballStore.ts holds per-room ball registry + field ball spawn
  - Placed-ball definitions persist to server/data/worldcup-balls.json (positions reset on load)
  - Client roomLayouts resolves field bounds/doors (or relies on server welcome) without breaking parity
verify:
  - "npm run build"
  - "Manual: connect with ?room=field returns a welcome with field bounds"
---

# 11 — Field room + ball store

Add the soccer field as a flag-gated room and the in-memory ball registry.

Notes:
- Hook `roomLayouts.ts`: `getRoomBaseBounds`, `getDoorsForRoom`, `hasRoom`, and the hub
  door list must include the field when the flag is on.
- `ballStore` owns: `ensureFieldBall(roomId)`, `getBalls(roomId)`, `resetBall(ball)`,
  `addPlacedBall`, `removePlacedBall`, load/save of placed defs.
