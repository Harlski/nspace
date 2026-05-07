# Public patch notes — developers (`0.3.1`)

**Audience:** contributors and integrators — APIs, WS messages, module boundaries, notable refactors.  
**Depth:** summarized technical changelog; not a full file list (that stays in [../reasons.md](../reasons.md)).

---

_(Not published for Nimiq Space yet.)_

- **No WS/protocol change** for mineable visuals — purely client rendering on existing obstacle props (`claimable` + `active`). Pattern for future block VFX: `skipBlockPickAndBounds` + solid-mesh-only selection bounds — see `Game.ts` and [docs/THE-LARGER-SYSTEM.md](../../../../docs/THE-LARGER-SYSTEM.md).
