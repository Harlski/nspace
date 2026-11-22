# Public patch notes — developers (`0.9.3`)

**Audience:** contributors and integrators — APIs, WS messages, module boundaries, notable refactors.  
**Depth:** summarized technical changelog; not a full file list (that stays in [../reasons.md](../reasons.md)).

---

- [NEW] Public Directory room `directory`. Teleporter props may include `targetRoomDisplayName`, `targetRoomOwnerAddress`, and `targetRoomPlayerCount`. `obstaclesDelta` may include `roomBounds` when the hall grows. Heat order is thumbs-up, then real occupant count. A dev-only preview count is display-only.
- [FIX] Profile and username-ban lookups compact the wallet the same way login does (spaces removed, then uppercased). The game socket was comparing the spaced session address to the compact profile key, closing `4009`, and the client reconnected because the prompt said a username already existed.
- [CHANGE] A `4009` close reconnects only after the player just saved a username. An account that already has one does not open another socket in a loop.
- [FIX] Login history, the hourly digest, and dossier last-visit/today stats match a wallet after stripping spaces and uppercasing the event-log address. A spaced session address and the compact profile key are the same player.
- [NEW] Admin login history: `GET /api/admin/player/activity?q=&hours=24|168` proxies Analytics Service `GET /v1/player-activity`. Connected spans, capped-gap active spans (5-minute idle cap), gameplay NIM deduped by `claimId`. Window max 8 days. No in-process Event Log fallback.
