# Tile design specification

Guidelines for designing floor tiles (2D textures or 3D meshes) so they align with the current **orthographic, dimetric-style** camera and grid in nspace.

## World & grid

- **Units:** One tile occupies **1×1 world unit** on the **XZ** plane. **Y is up.**
- **Centers:** Each tile’s center is at integer world coordinates `(x, z)` (e.g. tile column 3, row −2 → center `(3, 0, -2)`).
- **Grid bounds:** Tiles are valid within roughly **−250…249** on both axes (must stay consistent with server/path rules).

## Camera (what the player sees)

- **Projection:** Orthographic — no perspective distortion; parallel world lines stay parallel on screen.
- **Framing:** Vertical extent is controlled by an orthographic **half-height** in world units (default scale comes from `VIEW_FRUSTUM_SIZE`; players can zoom). Viewport aspect follows the game’s **16∶9** letterboxed layout.
- **View direction:** The camera sits offset by **(18, 18, 18)** from the look-at point on the ground and aims at that target — a **symmetric view from above +X and +Z**.
- **Screen shape of a tile:** A **world-axis-aligned square** on the floor projects to a **rhombus** on screen (equal foreshortening along world X and Z), similar to a **dimetric / pseudo-isometric** floor.

**Seams:** Neighbor continuity must hold along **world +X / −X** and **world +Z / −Z**, not along screen pixel axes.

## Current client meshes (reference sizes)

Use these to match existing floor, highlight, and blocks:

| Element            | Approximate size / placement                                                                                              |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Walkable floor     | Plane **0.98 × 0.98**, centered on `(tileX, 0.01, tileZ)` — small inset vs. 1×1 to reduce z-fighting between neighbors |
| Selection highlight| **0.92 × 0.92** at **y ≈ 0.02–0.03**                                                                                      |
| Block (box)        | Footprint **`BLOCK_SIZE` (0.82)**, centered on tile; height = full / half / quarter of that                                 |
| Block (hex)        | Hex prism with radius **≈ 0.47**, same xz center, **y = h/2**                                                              |

## 2D texture checklist

1. **Footprint:** Design one asset per logical cell, centered on the tile center in XZ.
2. **Inset:** To match the current floor quad, treat the drawn floor as **~0.98** of the cell; for full-cell bleed, plan on **1.0** and adjust the mesh/UVs when integrated.
3. **Height:** Keep floor content conceptually on **y = 0**; place geometry or decals **above ~0.01** if you add meshes to avoid fighting the base plane.
4. **Tiling:** Edge **A** of tile `(x, z)` that faces **+X** must match the **−X** edge of tile `(x+1, z)`. Same for **+Z** / `(x, z+1)`.
5. **Workflow:** Because screen edges are diagonal, use an **isometric/dimetric template** aligned with a **screenshot** from the live game (same zoom you care about).
6. **Resolution:** Use a consistent pixel size per cell (e.g. **64 / 128 / 256** px along one UV axis); ortho means scale does not change with “distance.”

## 3D tile / prop checklist

- **Pivot:** Tile center on the floor; **Y-up**.
- **Footprint:** Within **1×1** XZ (or **0.98** if matching the current floor plane exactly).
- **Seams:** Same world-axis neighbor rules as for textures.

## Code pointers (client)

- Grid and snapping: `client/src/game/grid.ts`
- Tile size / camera frustum constants: `client/src/game/constants.ts`
- Floor planes, block sizes, camera offset: `client/src/game/Game.ts` (`BLOCK_SIZE`, `walkableFloorMeshes`, `cameraOffset`)

Floors are currently **solid-colored planes**, not image textures. Wiring textures will typically use **tile coordinates in UVs or world XZ** so repeats align with integer `(x, z)`.
