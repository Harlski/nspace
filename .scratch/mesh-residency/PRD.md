---
title: Client mesh residency (view-interest)
status: done
glossary: CONTEXT.md
depends_on_grill: conversation (commons FPS / chunk residency grill)
---

# Client mesh residency (view-interest)

> Goal vocabulary: **Commons** (hub), view interest, walkable floor chunks, placed
> obstacles. Mesh residency is **client render only** - server authority and room
> data are unchanged.

## Problem Statement

On a dense Commons (thousands of placed obstacles and walkable floor tiles), frame
rate collapses in walk mode even when the orthographic view covers only a small
band of tiles. Small rooms reach ~120fps for a similar on-screen range. Cost today
tracks **room size**, not **what is on screen**. Players and builders expect that
the same view range should cost about the same everywhere.

## Solution

Keep full room **data** in memory (mesh-only residency). Build and retain Three.js
meshes only for chunks that intersect a **client residency rect** (same frustum +
padding math as view interest). Unload meshes with **+1 chunk hysteresis**. Fill
newly resident chunks with a **per-frame build budget**. Apply the same resident
set to placed terrain meshes (fancy groups and plain-cube batches) and walkable
floor visuals, in every room. Picks and movement stay **data-authoritative**.

## User Stories

1. As a player in Commons, I want FPS for a given zoom/pan to match a small room
   with a similar on-screen fill, so that dense rooms stay playable.
2. As a player walking or orbiting, I want off-screen block and floor meshes to
   leave the scene, so that GPU/CPU cost stays bounded by the view.
3. As a player panning near a chunk edge, I want meshes not to thrash every frame,
   so that motion stays smooth (unload hysteresis).
4. As a player entering a new chunk, I want meshes to appear over a few frames
   without a long hitch, so that movement does not spike frame time.
5. As a player clicking a tile whose mesh is still building, I want pathing and
   intents to use room data, so that the frontier does not feel dead.
6. As a player in build mode, I want the same residency rules as walk mode, so that
   editing does not reintroduce whole-room mesh cost.
7. As a player zooming out (including telescope), I want more chunks to become
   resident as the view grows, so that cost honestly tracks on-screen range.
8. As a stream operator using overview interest, I want residency to follow the
   widened interest rect, so that one rule covers stream cameras.
9. As a player in a small room, I want behavior unchanged, so that rooms fully
   inside the interest rect still mesh everything visible.
10. As a player, I want walkable floor visuals under the same resident set as
    blocks, so that Commons floors do not keep the whole map meshed.
11. As a developer, I want debug counters for resident chunks and live mesh counts,
    so that regressions are measurable without a GPU.
12. As a developer, I want a pure residency planner under test, so that load/unload
    hysteresis cannot silently break.
13. As a player with signposts in view, I want hint occlusion to keep working on
    resident meshes, so that doc icons still hide behind nearby blocks.
14. As a player leaving a chunk far behind, I want those meshes disposed, so that
    mesh count does not climb without bound during a session.
15. As a builder placing a block in the current view, I want it meshed promptly
    within the budget, so that authoring feedback stays responsive.
16. As a builder placing or deleting outside the current view, I want data to
    update immediately and mesh to appear when that chunk becomes resident, so
    that authority stays correct.
17. As a player on mobile, I want residency to reduce peak mesh count, so that
    dense Commons is usable on weaker GPUs.
18. As an admin with map overview unlocked, I want interest/residency caps to
    follow existing overview rules, so that overview remains intentional.
19. As a developer, I want server view-interest reporting unchanged for non-spatial
    rooms, so that Commons does not suddenly stream deltas.
20. As a player after a room change, I want residency to reset around the new
    camera, so that the previous room’s meshes do not linger.

## Implementation Decisions

- **Seam (single deep module):** a pure **mesh residency planner** that, given the
  previous resident chunk set and a client residency rect, returns the next
  resident set. Load = chunks intersecting the rect (no extra chunk pad beyond
  the rect’s tile padding). Keep/unload boundary = same rect with **+1 chunk**
  pad. Next = (previous ∩ keep) ∪ load.
- **Client residency rect:** always computed from orthographic frustum, aspect,
  look-at (or stream overrides), and existing tile padding / non-admin caps.
  Independent of `roomUsesSpatialInterest` so Commons qualifies. Server
  view-interest reporting stays spatially gated.
- **Game applies the plan:** on camera/interest changes and room enter, update
  resident chunks; enqueue missing block keys for budgeted mesh sync; dispose
  block/plain-cube/floor visuals outside the keep set; do not drop
  `placedObjects` / floor key data.
- **Budgeted build:** process a bounded amount of pending mesh work per tick
  (time or count budget); continuous render while the queue is non-empty.
- **Scope of meshes:** fancy block groups and plain-cube instanced batches share
  the resident set; walkable floor visual chunks use the same set (including
  non-spatial Commons).
- **Picks:** prefer data / existing pick paths; do not require a mesh for
  movement intents on known tiles.
- **Build / floor modes:** same residency policy.
- **Debug:** expose resident chunk count (and related live mesh counts) via
  existing debug stats.
- **No schema/API changes.**

## Testing Decisions

- Prefer behavior tests at the **planner seam** (pure functions): hysteresis,
  load vs keep rings, empty previous, full coverage when rect spans the room.
- Do not assert Three.js internals or private Game fields.
- Prior art: `interestChunks` helpers, `signpostHintOcclusion` unit tests,
  Game tests that mount with mocked WebGL when integration is needed.
- Acceptance: counters stay bounded by interest size; human FPS check on Commons
  vs a small room at matched frustum (from grill).

## Out of Scope

- Server chunk streaming / making Commons a spatial-interest room
- LOD, impostors, or merged distant meshes
- Soft fade-in of newly resident chunks
- Build mode loading the entire room
- Changing signpost occlusion algorithm beyond operating on resident meshes
- Props beyond terrain + floors in v1 (billboards, attention markers, sale
  displays) unless they share block mesh sync already

## Further Notes

- Grill decisions: mesh-only; view-interest window; +1 unload hysteresis;
  budgeted fill; data-authoritative picks; everywhere; stream follows interest;
  floors in v1; counters + FPS acceptance; client rect split from server
  interest.
- Related prior fix: signpost-hint occlusion narrowphase (reduces walk-mode CPU;
  residency addresses scene-graph / draw scale).
