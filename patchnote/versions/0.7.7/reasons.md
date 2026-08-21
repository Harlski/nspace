# Reasons — 0.7.7 (patch-notes version)

**Patch-notes version:** `0.7.7` (frozen via `npm run prepare-merge`).

**Role:** Technical **reasons** attached to **this** patch-notes version — file-level and behavior-level inventory. Public-facing copy at other depths lives only under [public/](public/).

---

## Summary

Ambient Cast on the Main Menu: lean Face Token snapshot API + Soft Density walkers. Path Playback: stop after-drain camera rewind / path-start restart under latency.

---

## By area

### Repo / docs

- Glossary: **Main Menu**, **Ambient Cast**, **Face Token**, **Soft Density** in [CONTEXT.md](../../../CONTEXT.md)
- Spec: [.scratch/ambient-main-menu-cast/PRD.md](../../../.scratch/ambient-main-menu-cast/PRD.md)
- [docs/features-checklist.md](../../../docs/features-checklist.md) — Path Playback never-rewind after drain

### Client

- [client/src/ambientCast/](../../../client/src/ambientCast/) — Face Token decode/render, Soft Density, canvas Ambient Cast mounted from [mainMenu.ts](../../../client/src/ui/mainMenu.ts)
- ~5 min snapshot refresh; ~8–12 Soft Density; pointer-events none
- [moveOrderPlayback.ts](../../../client/src/game/moveOrderPlayback.ts) / [Game.ts](../../../client/src/game/Game.ts) `applyPoseHeartbeat` — lagged `walking=false` after Path Playback drain no longer rewinds `selfMesh` (camera); hold kept so late duplicate same-walk `moveOrder` cannot restart at origin. Regression: [selfCameraRubberband.test.ts](../../../client/src/game/selfCameraRubberband.test.ts) (incl. 193ms / 10-tile case)
- [cameraSelfSync.ts](../../../client/src/game/cameraSelfSync.ts) — while `selfMoveOrder` is active, ignore stale `stateDelta` pose “jumps” (>6 tiles from omitted-pose `lastPlayers` walk-start). Was yanking `cameraLookAt` back every ~`STATE_BROADCAST_MIN_MS` (~120–150ms); confirmed via `?camjit=1` capture. Opt-in hitch recorder: [cameraJitterCapture.ts](../../../client/src/game/cameraJitterCapture.ts)

### Server

- [server/src/ambientCast/](../../../server/src/ambientCast/) — Face Token encode from identicon features; eligibility from Event Log `session_start` (exclude Play Spaces)
- Public **`GET /api/ambient-cast`** → `{ day, refreshedAt, faces: [{ token }] }` (no wallet IDs)
- [eventLog.ts](../../../server/src/eventLog.ts) `listEventRecordsForUtcDay`

### payment-intent-service

- _(none in this change set)_

### Deploy / ops

- _(none in this change set)_
