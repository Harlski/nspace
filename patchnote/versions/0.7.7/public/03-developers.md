# Public patch notes — developers (`0.7.7`)

**Audience:** contributors and integrators — APIs, WS messages, module boundaries, notable refactors.  
**Depth:** summarized technical changelog; not a full file list (that stays in [../reasons.md](../reasons.md)).

---

- **[NEW]** `GET /api/ambient-cast` — unauthenticated snapshot `{ day, refreshedAt, faces: [{ token }] }`. Tokens are `ac1_` + base64url feature packs matching `@nimiq/identicons` faces; no wallet fields.
- **[NEW]** Client `ambientCast/` — Soft Density staging, Face Token → SVG, Main Menu canvas layer (dispose with the menu).
- Glossary: **Ambient Cast**, **Face Token**, **Soft Density**, **Main Menu** in `CONTEXT.md`.
- **[FIX]** Path Playback: lagged `walking=false` after drain no longer rewinds `selfMesh`; late duplicate same-walk `moveOrder` cannot restart at origin. Active `selfMoveOrder` ignores stale `stateDelta` pose jumps (>6 tiles) that were yanking `cameraLookAt` on the broadcast cadence.
