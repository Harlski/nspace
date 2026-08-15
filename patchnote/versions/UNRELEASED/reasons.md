# Reasons — UNRELEASED (patch-notes version)

**Patch-notes version:** `UNRELEASED` (working bucket). Before merging to `main`, run `npm run prepare-merge` so this folder is frozen under a semver that matches [package.json](../../../package.json) (see [patchnote/README.md](../../README.md)).

**Role:** Technical **reasons** attached to **this** patch-notes version — file-level and behavior-level inventory. Public-facing copy at other depths lives only under [public/](public/).

---

## Summary

Dense Commons stays smoother: signpost occlusion no longer scans the whole room each frame, and terrain/floor meshes follow the camera view.

---

## By area

### Repo / docs

- [.scratch/mesh-residency/PRD.md](../../../.scratch/mesh-residency/PRD.md) — mesh residency grill → ready/done ticket.

### Client

- [PERF] Signpost-hint foreground occlusion uses a tile-bucket narrowphase along the camera→hint segment (`signpostHintOcclusion.ts`, `Game.updateSignpostHintSprites`); bench `client/scripts/signpost-hint-occl-bench.mjs` (`MODE=naive` vs `narrow`).
- [PERF] **Client mesh residency** — full obstacle/floor data stays in memory; Three meshes only for chunks in a client residency rect (frustum + padding, every room including Commons); unload +1 chunk hysteresis; budgeted mesh fill; floors included (`meshResidency.ts`, `Game.ts`). Debug HUD: resident chunks, live blocks, build queue.

### Server

- _(none in this change set)_

### payment-intent-service

- _(none in this change set)_

### Deploy / ops

- _(none in this change set)_
