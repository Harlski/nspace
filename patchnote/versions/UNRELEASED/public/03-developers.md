# Public patch notes — developers (`UNRELEASED`)

**Audience:** contributors and integrators — APIs, WS messages, module boundaries, notable refactors.  
**Depth:** summarized technical changelog; not a full file list (that stays in [../reasons.md](../reasons.md)).

---

- [FIX] Profile and username-ban lookups compact the wallet the same way login does (spaces removed, then uppercased). The game socket was comparing the spaced session address to the compact profile key, closing `4009`, and the client reconnected because the prompt said a username already existed.
- [CHANGE] A `4009` close reconnects only after the player just saved a username. An account that already has one does not open another socket in a loop.
