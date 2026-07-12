# Attention Markers are a parallel tile-keyed layout layer

**Attention Markers** mark a floor tile so players notice or act there (tutorial mine blocks,
Unlock Pads, empty floor). They are purely visual: fixed V glyph, always-on bounce, glow
matching tint, **Hover Height** `0..3` above the live top of the co-occupant (else floor).
They must share a tile with an existing obstacle or sit on empty floor, so they cannot live
as ordinary obstacle stack slots (`y` 0..2) without stealing or replacing the thing they
point at.

**Decision:** store and sync Attention Markers as a **parallel tile-keyed layout layer**
(at most one per `(x, z)`), included in the **Build Shell**, independent of the obstacle map.
Tile-bound (not object-attached); moving/deleting the co-occupant leaves the marker; baseline
live-follows. Admin-only Buildings tool in v1. Build pick selects the co-occupant unless the
Attention Marker tool is active; walk mode never picks the marker.

**Considered options:** attach to the underlying obstacle — breaks “any tile” and empty-floor
cues, and dies when the pad/block moves; extend obstacle `y` / stack the V as a block —
collides with gameplay solids and stack limits; client-only / non-templated overlay — cannot
ship with Tutorial Template publish; reuse voxel text — admin-overlay path, wrong authoring
surface for Buildings dock.

Future readers should not fold Attention Markers into `ObstacleTile` stack slots, or make them
object-owned, without revisiting this ADR.
