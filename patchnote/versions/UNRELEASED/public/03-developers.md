# Public patch notes — developers (`UNRELEASED`)

**Audience:** contributors and integrators — APIs, WS messages, module boundaries, notable refactors.  
**Depth:** summarized technical changelog; not a full file list (that stays in [../reasons.md](../reasons.md)).

---

_(Draft — not published.)_

- [NEW] Admin login history: `GET /api/admin/player/activity?q=&hours=24|168` proxies Analytics Service `GET /v1/player-activity`. Connected spans, capped-gap active spans (5-minute idle cap), gameplay NIM deduped by `claimId`. Window max 8 days. No in-process Event Log fallback.
