# Public patch notes — developers (`0.3.17`)

**Audience:** contributors and integrators — APIs, WS messages, module boundaries, notable refactors.  
**Depth:** summarized technical changelog; not a dump of `reasons.md` (that stays in [../reasons.md](../reasons.md)).

---

- **[NEW]** **Floor color wire** — `placeExtraFloor` accepts optional **`colorRgb`**. Server stores extra floor as **`Map<tileKey, colorRgb>`** and core-grid overrides in **`roomBaseFloorColors`**. Outbound: welcome **`baseFloorColorTiles`**, live **`baseFloorColorDelta`** (`add` / `remove`), **`extraFloorDelta`** tiles include **`colorRgb`**. Recolor on existing extra or base tiles does **not** require an empty tile (blocks allowed); new extra placement still follows connectivity / occupancy rules.
- **[NEW]** **Cube rotation** — `cubeRotX` / `cubeRotY` / `cubeRotZ` (0–3 = 90° steps) on plain cubes in `PlacedProps`, obstacle snapshots, and client placement style; legacy **`cubePitch`** → one X step on load.
- **[FIX]** **`tileHasPlacedBlocks`** uses `"x,z,"` prefix (stack keys), not bare `tileKey`.
- **[CHANGE]** Client floor visuals: single instanced batch with **`instanceColor`**, **`MeshStandardMaterial`** aligned with placed blocks (`roughness` 0.65 / `metalness` 0.15), default tile quad scale **1.01**.

Full inventory: [../reasons.md](../reasons.md).
