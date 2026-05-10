# Public patch notes — developers (`0.3.8`)

**Audience:** contributors and integrators — APIs, WS messages, module boundaries, notable refactors.  
**Depth:** summarized technical changelog; not a full file list (that stays in [../reasons.md](../reasons.md)).

---

- [PERF] **Demand-driven scene renders (`client/src/game/Game.ts`):** Full WebGL scene submissions run only while visuals are dirty or briefly active (movement, pointer activity, scene changes, path fades, floating text).
- [PERF] **Lower baseline render cost (`client/src/game/Game.ts`, `docs/build.md`):** MSAA defaults off, walkable floor tiles use instanced meshes, and fog-off rendering bypasses the legacy fog post-process pass.
