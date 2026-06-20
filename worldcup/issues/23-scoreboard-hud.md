---
id: "23-scoreboard-hud"
milestone: M2
depends_on: ["21-goal-detection"]
status: todo
acceptance:
  - Field-room scoreboard panel shows top countries (flag + goals), updating live on goalScored
  - A flag button (current country) opens the country picker
  - Panel only shows in the field room and only when WORLDCUP_ENABLED
verify:
  - "npm run build"
  - "Manual (M2 checkpoint): score a goal and watch the scoreboard update"
---

# 23 — Scoreboard HUD

Lightweight in-room panel listing the leading countries, refreshed by `goalScored`
events (and the welcome snapshot on join). Includes the change-country flag button.
