# Reasons — 0.7.2 (patch-notes version)

**Patch-notes version:** `0.7.2` (frozen via `npm run prepare-merge`).

**Role:** Technical **reasons** attached to **this** patch-notes version — file-level and behavior-level inventory. Public-facing copy at other depths lives only under [public/](public/).

---

## Summary

Dense Commons stays smoother: signpost occlusion no longer scans the whole room each frame, and terrain/floor meshes follow the camera view. While moving, occlusion and residency checks are throttled so walk FPS stays closer to idle. Room loads show a percent. Leaving Commons for Hub clears ghost floors. Wardrobe Preview uses the room backdrop again; Sale Display Buy keeps the solid color cycle.

---

## By area

### Repo / docs

- [.scratch/mesh-residency/PRD.md](../../../.scratch/mesh-residency/PRD.md) — mesh residency grill → ready/done ticket.
- [CONTEXT.md](../../../CONTEXT.md) / [docs/features-checklist.md](../../../docs/features-checklist.md) — Wardrobe Preview Backdrop vs Sale Display Buy stock backdrop.

### Client

- [PERF] Signpost-hint foreground occlusion uses a tile-bucket narrowphase along the camera→hint segment (`signpostHintOcclusion.ts`, `Game.updateSignpostHintSprites`); bench `client/scripts/signpost-hint-occl-bench.mjs` (`MODE=naive` vs `narrow`).
- [PERF] **Client mesh residency** — full obstacle/floor data stays in memory; Three meshes only for chunks in a client residency rect (frustum + padding, every room including Commons); unload +1 chunk hysteresis; budgeted mesh fill; floors included (`meshResidency.ts`, `Game.ts`). Debug HUD: resident chunks, live blocks, build queue.
- [PERF] Mesh residency refresh side-effects (floor rebuild / enqueue) run only when the **chunk set** changes, not on every camera pan; incremental floor sync + chunk indexes for extras/obstacles (fixes move-only FPS collapse / multi-second freezes). Bench: `client/scripts/mesh-residency-move-bench.mjs`.
- [PERF] While moving: signpost occlusion raycasts only when camera XZ crosses a ~0.45-tile quant; cached `signpostHintGroupsBuf`; residency `nextResidentChunks` skipped until look-at moves ~2 tiles (`Game.ts`).
- [UX] Commons (`hub`) normal max zoom-out raised: `HUB_MAX_ZOOM_FRUSTUM` 18 → **22.9** (Telescope hold remains 2× that).
- [FIX] Leaving Commons for Hub (or any room change) disposes walkable floor / door marker meshes; incremental residency alone did not treat prior-room tiles as “left” when the resident chunk set was reset (ghost Commons layout + stuck feel).
- [UX] Loading overlay progress bar shows an integer percent (and `…` while indeterminate).
- `bindWardrobeAvatarPreviewCanvas` — `backdrop: "room"` (default) restores Wardrobe Preview Backdrop; `backdrop: "stock"` keeps Black/White/Dark green cycle for Sale Display Buy (`Game.ts`, `main.ts`).

### Server

- _(none in this change set)_

### payment-intent-service

- _(none in this change set)_

### Deploy / ops

- _(none in this change set)_
