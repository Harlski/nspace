# Public patch notes — hotfix (`0.8.2`)

**Audience:** anyone during a corrective release — what broke, what we patched, why now.  
**Depth:** short incident-shaped summary; not a full reasons dump.

---

**What was wrong:** In Mosquito Tag, becoming Holder flashed the screen green (same family as Join and Participant Markers), so “you have the mosquito” did not read as danger. Boost Pads could also spawn on walkable tiles that still had a cube, ramp, or stack on them, so the green portal sat inside or under blocks.

**What we changed:**
- [FIX] Becoming Holder flashes the screen red (same danger red as Stung).
- [FIX] Boost Pads spawn only on empty walkable floor: no placed block on that tile.

**Why now:** First Tag Rounds in built rooms made both bugs obvious. Small client CSS plus spawn-pool patch; no env, WS, or operator action.
