---
id: "10-ball-physics"
milestone: M1
depends_on: ["00-scaffold"]
status: todo
acceptance:
  - Pure module server/src/worldcup/ballPhysics.ts with no server/runtime imports
  - stepBall integrates position, applies rolling friction, clamps max speed
  - Ball reflects off room-bound walls with restitution; optional solid-tile predicate
  - applyKick sets velocity from a direction + speed (clamped)
  - kickFromPlayer derives direction/speed from a player heading + speed
  - detectGoal returns the goal id whose rect contains the ball center, else null
  - Unit tests cover: friction stop, wall bounce, max-speed clamp, goal detect, kick
verify:
  - "npm test -w server (ballPhysics tests pass)"
---

# 10 — Pure ball physics

Ground-only 2D simulation as pure functions (easy to unit test, no I/O). World units
== tiles; tile centers at integer indices; walls at `bounds.min-0.5` / `bounds.max+0.5`.

Exports (suggested):
- `stepBall(ball, dt, bounds, cfg, isSolidTile?)`
- `applyKick(ball, dirX, dirZ, speed, cfg)`
- `kickFromPlayer({ px, pz, vx, vz, bx, bz }, kickCfg)` -> `{ dirX, dirZ, speed }`
- `detectGoal(ball, goals)` -> `"west" | "east" | null`
