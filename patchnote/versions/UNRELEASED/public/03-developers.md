# Public patch notes — developers (`UNRELEASED`)

**Audience:** contributors and integrators — APIs, WS messages, module boundaries, notable refactors.  
**Depth:** summarized technical changelog; not a full file list (that stays in [../reasons.md](../reasons.md)).

---

- [NEW] Player profiles now use `@nimconnect/profile-client@0.5.0` for optional
  address-to-handle enrichment. Lookups are client-only, independently loaded,
  stale-response guarded, and fail silently; server-owned display names,
  `PlayerState`, and WebSocket contracts are unchanged.
