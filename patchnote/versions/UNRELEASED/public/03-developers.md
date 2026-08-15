# Public patch notes — developers (`UNRELEASED`)

**Audience:** contributors and integrators — APIs, WS messages, module boundaries, notable refactors.  
**Depth:** summarized technical changelog; not a full file list (that stays in [../reasons.md](../reasons.md)).

---

- [PERF] `nextResidentChunks` planner (`meshResidency.ts`) + Game mesh-only residency (client rect always; server `setViewInterest` still spatial-gated).
- [PERF] Signpost occlusion narrowphase (`signpostHintOcclusion.ts`); optional bench `MODE=naive|narrow`.
- Debug HUD: `meshResidentChunkCount`, `liveBlockMeshCount`, `meshBuildPendingCount`.
