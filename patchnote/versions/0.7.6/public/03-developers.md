# Public patch notes — developers (`0.7.6`)

**Audience:** contributors and integrators — APIs, WS messages, module boundaries, notable refactors.  
**Depth:** summarized technical changelog; not a full file list (that stays in [../reasons.md](../reasons.md)).

---

- [FIX] `joinRoom` into an invite lobby seeds Play Space layout before Join Spawn resolution, so welcome pose is the template teleporter tile, not lounge center `(0, 0)` or Hub standing coords.
- [FIX] Same-WS welcome hard-snaps `selfMesh` (`pendingRoomWelcomeSnap`). Hub `(-5, 0)` to lounge `(0, 0)` is under the 6-tile jump threshold and previously kept the prior-room mesh.
- [FIX] Pixel Collaborator occupancy is taken from `roomOf(currentRoomId)`, not the connect-time Hub/Chamber map. `otherPresentWalletsFromOccupants` is the shared occupant-set helper.
- [FIX] Profile username inline input sizes to `USERNAME_MAX_LEN` (12) instead of collapsing with `min-width: 0`.
