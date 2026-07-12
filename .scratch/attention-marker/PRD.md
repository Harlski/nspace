---
title: Attention Marker
status: ready-for-agent
glossary: CONTEXT.md
adrs:
  - docs/adr/0009-attention-marker-tile-layer.md
depends_on_grill: CONTEXT.md (Attention Marker, Hover Height)
---

# Attention Marker

> Vocabulary follows [CONTEXT.md](../../CONTEXT.md): **Attention Marker**, **Hover Height**,
> **Unlock Pad**, **Gate**, **Build Shell**, **Tutorial Template**, **Tutorial Staging**.

## Problem Statement

Tutorial and curated rooms need a clear visual cue that says “do something here” over a
mineable block or **Unlock Pad** without replacing that object. Today authors lack a
co-occupying placeable for that cue; stacking a block or reusing voxel text fights the
obstacle map and the Buildings dock.

## Solution

Add **Attention Marker**: a placeable, purely visual cue anchored to a floor tile (at most
one per tile) that may share the tile with a block, Unlock Pad, Gate, or empty floor. The
glyph is a fixed glowing V with a continuous gentle hover bounce. Authors set **Hover
Height** (`0..3`, default `1`) and tint via the hue ring (default white; glow matches).
Hover Height lifts above the live top of the current co-occupant (else floor). Placement,
edit, and move are **admin-only** in v1 under Buildings. Markers are first-class **Build
Shell** content so Tutorial Staging → Template publish carries them.

## User Stories

### Player — see the cue

1. As a player in a room with an Attention Marker, I want to see a floating glowing V over
   that tile, so that I notice where to act.
2. As a player, I want the V to gently bounce up and down, so that it reads as a living cue
   rather than static décor.
3. As a player, I want the marker’s height to sit above whatever occupies the tile (or the
   floor if empty), so that it is not buried inside a block or Unlock Pad.
4. As a player, when a taller block is placed under a marker or the Unlock Pad is removed, I
   want the V’s world height to update automatically, so that authors need not re-place it.
5. As a player walking the world, I want clicking or tapping the marker to do nothing
   special, so that interaction stays on the Unlock Pad, mine block, or empty floor.
6. As a player, I want markers with custom tint (not only white) to render with matching
   glow, so that curated rooms can color-code cues.

### Admin — place and author

7. As a game admin in build mode, I want an Attention Marker tool under Buildings, so that I
   can place cues like other special buildings.
8. As a game admin, I want to place a marker on any tile (empty, mine block, Unlock Pad,
   Gate), so that tutorial Mine and Pay beats can be marked without clearing the object.
9. As a game admin, I want at most one marker per tile, with re-place replacing the old one,
   so that tiles do not stack conflicting cues.
10. As a game admin, I want Hover Height `0..3` (default `1`) in the dock parameters, so that
    I can float the V higher above tall stacks.
11. As a game admin, I want the shared hue ring to tint the marker (default white), so that
    color authoring matches other Buildings.
12. As a game admin, when the Attention Marker tool is active, I want clicking a marked tile
    to select the marker, so that I can edit Hover Height, color, move, or delete it.
13. As a game admin, when another tool is active, I want clicking a tile with both a
    co-occupant and a marker to select the co-occupant, so that normal object editing is not
    blocked.
14. As a game admin, I want to move a marker to another tile with a ghost preview, replacing
    any marker already on the destination, so that layout tweaks match other placeables.
15. As a game admin, I want markers to stay visible in build mode, so that I can author
    without the cue disappearing.
16. As a game admin who is not an admin, I want the Attention Marker tool hidden or denied,
    so that Commons builders cannot spam floating Vs in v1.
17. As a game admin publishing a Tutorial Template, I want Attention Markers included in the
    Build Shell round-trip, so that staging cues appear on the live Tutorial Room after sync.

### System / authority

18. As the server, I want Attention Markers stored as a parallel tile-keyed layer (not
    obstacle stack slots), so that co-occupation and empty-floor cues stay valid
    ([ADR 0009](../../docs/adr/0009-attention-marker-tile-layer.md)).
19. As the server, I want welcome / snapshot / delta sync to include markers for the room, so
    that clients render the same cues.
20. As the client, I want walk-mode picks to ignore marker meshes (decorative overlay rules),
    so that markers never steal selection from gameplay objects.

## Implementation Decisions

- Respect ADR **0009** and glossary terms **Attention Marker** / **Hover Height**.
- Primary seam: deep server **Attention Marker domain module** — normalize record shape,
  upsert (replace on same tile), move (replace on destination), remove, list for room,
  replace-all for Build Shell apply. Room WS handlers and Build Shell extract/apply are thin
  adapters.
- Persist markers with room layout state (same durability class as obstacles), keyed by
  room + `(x, z)`; at most one per floor tile.
- Authoritative fields: `x`, `z`, `hoverHeight` (`0..3`), `colorRgb`. Glyph, bounce, glow,
  and baseline lift are client presentation; Hover Height steps are authoritative.
- Baseline resolution (top of co-occupant) is **client-only**; server does not store world Y.
- WS: admin-only place / update props / move / remove; broadcast full or delta marker lists
  for the room (prior art: signboards / obstaclesDelta patterns).
- Build Shell: add an `attentionMarkers` array (or equivalent) to the shell snapshot; tutorial
  extract with `keepSpecials` includes them; apply clears and rewrites the room’s marker layer.
- Client Buildings dock: Attention Marker tool (admin-gated like Unlock Pad / Billboard);
  dock params for Hover Height; hue ring for color; selection when tool active; reposition
  ghost; stay visible in build mode.
- Render: fixed V mesh + emissive/glow tinted with `colorRgb`; continuous gentle Z bounce;
  world Y = co-occupant top (or floor) + Hover Height step scale; `skipBlockPickAndBounds` in
  walk mode; pickable only when Attention Marker tool is active in build mode.
- Do not attach markers to obstacle instance ids; deleting/moving the co-occupant leaves the
  marker on the tile.

## Testing Decisions

### What makes a good test

Assert external behavior through the Attention Marker domain module and Build Shell
round-trip contracts. Do not assert Three.js meshes, bounce math constants, or CSS.

### Primary seam — Attention Marker domain module

| Behavior | Assertion |
|----------|-----------|
| Upsert | placing on a tile creates or replaces the single marker |
| Normalize | invalid hoverHeight / color rejected or clamped per contract |
| Move | source cleared; destination replaced if occupied |
| Remove | tile has no marker after remove |
| List | room listing returns all markers for that room only |
| Replace-all | Build Shell apply yields exactly the applied set |

Prior art: Unlock Pad normalize/config tests; signboard CRUD tests if any; Build Shell tests.

### Build Shell

Extract includes markers; apply restores them on a cleared room writer. Prior art:
`playSpaceTemplate` / tutorial template Build Shell tests.

### Client helpers (light, optional)

Tool-active vs tool-inactive pick preference; Hover Height step → offset mapping if pure.
Prior art: `buildDockContextParams` tests.

Avoid full WebGL E2E in CI; manual acceptance: place over Unlock Pad and mine block in
Tutorial Staging, sync template, confirm live Tutorial Room.

## Out of Scope

- Non-admin placement
- Multiple markers per tile
- Configurable glyph / shape variants
- Bounce toggle or per-marker bounce amp
- Separate glow color control
- Gameplay effects, click targets, proximity prompts, tutorial coach wiring
- Object-attached markers (follow Unlock Pad instance)
- Extending obstacle stack `y` to 0..3 for markers
- Client-only / non-templated overlays

## Further Notes

- Grilling locked the product decisions; ADR 0009 is normative for the parallel tile layer.
- Prefer one Attention Marker domain module over scattering Map mutations inside `rooms.ts`.
- Default Hover Height is `1`; default color is white (`0xffffff`).
