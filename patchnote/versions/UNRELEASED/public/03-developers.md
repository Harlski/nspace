# Public patch notes — developers (`UNRELEASED`)

**Audience:** contributors and integrators — APIs, WS messages, module boundaries, notable refactors.  
**Depth:** summarized technical changelog; not a full file list (that stays in [../reasons.md](../reasons.md)).

---

_(Draft — not published.)_

- [CHANGE] `buildDefaultTutorialBootstrapShell` / `TUTORIAL_DEFAULT_BOUNDS` — portrait 7×15 Tutorial Path per ADR 0006; covered by `server/test/tutorialBootstrapShell.test.ts`.
- [NEW] Attention Marker parallel tile layer (ADR 0009): `server/src/attentionMarker/`, WS `placeAttentionMarker` / `setAttentionMarkerProps` / `moveAttentionMarker` / `removeAttentionMarker` / `attentionMarkers`, Build Shell `attentionMarkers`, client `attentionMarkerVisual.ts`.
