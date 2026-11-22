# Public patch notes — developers (`UNRELEASED`)

**Audience:** contributors and integrators — APIs, WS messages, module boundaries, notable refactors.  
**Depth:** summarized technical changelog; not a full file list (that stays in [../reasons.md](../reasons.md)).

---

- [FIX] Profile and username-ban lookups compact the wallet the same way login does (spaces removed, then uppercased). The game socket was comparing the spaced session address to the compact profile key, closing `4009`, and the client reconnected because the prompt said a username already existed.
- [CHANGE] A `4009` close reconnects only after the player just saved a username. An account that already has one does not open another socket in a loop.
- [NEW] Admin login history: `GET /api/admin/player/activity?q=&hours=24|168` proxies Analytics Service `GET /v1/player-activity`. Connected spans, capped-gap active spans (5-minute idle cap), gameplay NIM deduped by `claimId`. Window max 8 days. No in-process Event Log fallback.
