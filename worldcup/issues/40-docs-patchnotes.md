---
id: "40-docs-patchnotes"
milestone: M4
depends_on: ["22-country-picker", "23-scoreboard-hud", "24-leaderboard-api", "31-place-ball-client"]
status: done
acceptance:
  - patchnote/versions/UNRELEASED/public tiers (brief/players/operators/developers) updated
  - patchnote/versions/UNRELEASED/reasons.md gains the technical detail
  - docs/features-checklist.md notes the seasonal soccer feature
  - Deprecation/removal steps documented (flag off + delete worldcup/ + remove hooks)
verify:
  - "npm run build"
---

# 40 — Finalize docs + patch notes

Author the audience-facing patch notes and update the features checklist. Capture the
WORLDCUP_ENABLED / VITE_WORLDCUP_ENABLED env vars in operator notes and the
WS/API deltas in developer notes.
