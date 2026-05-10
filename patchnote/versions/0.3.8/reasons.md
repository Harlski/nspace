# Reasons — 0.3.8 (patch-notes version)

**Patch-notes version:** `0.3.8` (frozen via `npm run prepare-merge`).

**Role:** Technical **reasons** attached to **this** patch-notes version — file-level and behavior-level inventory. Public-facing copy at other depths lives only under [public/](public/).

---

## Summary

- **Rendering performance:** The client stops submitting full Three.js scene renders while the room is visually idle, wakes rendering on scene / pointer / movement changes, disables WebGL antialiasing by default, batches walkable floor visuals, and bypasses the legacy fog post-process path while fog is off (`client/src/game/Game.ts`, `client/src/main.ts`, `docs/build.md`).

---

## By area

### Repo / docs

- `docs/build.md` — clarifies that legacy fog is optional/default-off and that normal rendering bypasses the fog pass while fog is disabled.

### Client

- **Idle render gating (`client/src/game/Game.ts`, `client/src/main.ts`):** `Game.tick()` still advances movement, camera easing, overlays, and UI anchors every RAF, but full WebGL scene submission now happens only while visual state is dirty/active. Scene mutations, resize/zoom, pointer interactions, player movement, path fades, and floating text request a render window; idle rooms stop redrawing the unchanged scene. Fog remains available, but disabled fog now bypasses `FogOfWarPass.render()` and calls the normal scene render directly.
- **Render load reduction (`client/src/game/Game.ts`):** WebGL antialiasing defaults off and walkable floor visuals are batched with instanced meshes to reduce scene draw cost.

### Server

- _(none in this change set)_

### payment-intent-service

- _(none in this change set)_

### Deploy / ops

- _(none in this change set)_
