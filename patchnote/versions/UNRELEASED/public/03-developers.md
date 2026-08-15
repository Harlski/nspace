# Public patch notes — developers (`UNRELEASED`)

**Audience:** contributors and integrators — APIs, WS messages, module boundaries, notable refactors.  
**Depth:** summarized technical changelog; not a full file list (that stays in [../reasons.md](../reasons.md)).

---

- [PERF] Client mesh-only residency (`meshResidency.ts`): frustum + padding rect every room; +1 chunk unload hysteresis; budgeted fill; floors included. Side-effects only on chunk-set change; look-at delta gate while moving.
- [PERF] Signpost occlusion narrowphase (`signpostHintOcclusion.ts`) + quantized camera re-ray; hint-group cache.
- [UX] `HUB_MAX_ZOOM_FRUSTUM` = 22.9 (was 18); Telescope hold = 2×.
- [FIX] `applyRoomFromWelcome` clears walkable floor + door meshes after residency reset (Commons→Hub ghost floors).
- [UX] Loading overlay shows live percent via `setLoadingProgress`.
- [CHANGE] `bindWardrobeAvatarPreviewCanvas({ backdrop: "room" | "stock" })` — room default for Wardrobe; stock for Sale Display Buy.
- Debug HUD: `meshResidentChunkCount`, `liveBlockMeshCount`, `meshBuildPendingCount`.
