# Tile design specification

Guidelines for designing floor tiles (2D textures or 3D meshes) so they align with the current **orthographic, dimetric-style** camera and grid in nspace.

## World & grid

- **Units:** One tile occupies **1×1 world unit** on the **XZ** plane. **Y is up.**
- **Centers:** Each tile’s center is at integer world coordinates `(x, z)` (e.g. tile column 3, row −2 → center `(3, 0, -2)`).
- **Grid bounds:** Tiles are valid within roughly **−250…249** on both axes (must stay consistent with server/path rules).

## Camera (what the player sees)

- **Projection:** Orthographic — no perspective distortion; parallel world lines stay parallel on screen.
- **Framing:** Vertical extent is controlled by an orthographic **half-height** in world units (default from `VIEW_FRUSTUM_SIZE`, typically **6**, clamped by min/max zoom; players can zoom). Viewport aspect follows the game’s **16∶9** letterboxed layout.
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

**Textured floors:** not in the default client today (planes are solid colors). If you add textures or custom floor meshes, follow [brainstorm/tile-artist-guide.md](brainstorm/tile-artist-guide.md).

## Code pointers (client)

- Grid and snapping: `client/src/game/grid.ts`
- Tile size / camera frustum constants: `client/src/game/constants.ts`
- Floor planes, block sizes, camera offset: `client/src/game/Game.ts` (`BLOCK_SIZE`, `walkableFloorMeshes`, `cameraOffset`)
