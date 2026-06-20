---
id: "31-place-ball-client"
milestone: M3
depends_on: ["30-place-ball-server"]
status: done
acceptance:
  - Build dock gains a "Ball" prop (Props tab) when WORLDCUP_ENABLED
  - Placing it sends placeBall at the targeted tile; a ghost/preview shows intent
  - Removing a placed ball is possible for builders
verify:
  - "npm run build"
  - "Manual (M3 checkpoint): place + kick a ball in a non-field room"
---

# 31 — Place a ball anywhere (client)

Add the authoring affordance following the build-dock contract (category tab, preview).
Ship with a placement preview per the reposition-ghost norm.
