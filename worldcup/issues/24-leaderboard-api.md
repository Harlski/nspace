---
id: "24-leaderboard-api"
milestone: M2
depends_on: ["20-score-store"]
status: todo
acceptance:
  - GET /api/worldcup/leaderboard returns { countries:[...], players:[...] } (flag-gated)
  - Mirrors the existing /api/canvas/leaderboard route pattern; public read
verify:
  - "npm run build"
  - "Manual: curl /api/worldcup/leaderboard returns the tally JSON"
---

# 24 — Leaderboard HTTP API

Public read endpoint for the tally, registered in `index.ts` before the SPA
catch-all. Returns 404 when the feature is disabled.
