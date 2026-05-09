# Public patch notes — developers (`0.3.3`)

**Audience:** contributors and integrators — APIs, WS messages, module boundaries, notable refactors.  
**Depth:** summarized technical changelog; not a full file list (that stays in [../reasons.md](../reasons.md)).

---

- **Gates (client):** reposition path adds ghost mesh + `refreshGateRepositionPreviewsFromStoredPointer`, frozen source render in `syncBlockMeshes`; HUD copy and ACL add-player UI per [reasons.md](../reasons.md).
- **Gates (server):** relaxed neighbor walk rules for placement/exit edits, hub `openGate` / pathfinding alignment, `gateWalkBlocked`, `setGateAuthorizedAddresses`, `placePendingGate` `colorId`, editor ignored on exit/front for occupancy — see [reasons.md](../reasons.md).
- **Rooms:** persisted join spawn + `roomJoinSpawn` / `updateRoom` joinSpawn patch; header marquee API and admin surface — see [reasons.md](../reasons.md).
