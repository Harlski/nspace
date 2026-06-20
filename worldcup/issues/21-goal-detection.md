---
id: "21-goal-detection"
milestone: M2
depends_on: ["20-score-store", "12-server-tick-sync"]
status: todo
acceptance:
  - Tick detects a ball entering a field goal zone, credits last kicker (within window)
  - Only the official field room contributes to the tally
  - Ball resets to center with a goal cooldown; goalScored broadcast (scorer, country, top countries)
  - setCountry WS handler persists choice + flushes pending goals; flag-gated
  - welcome (field room) includes selfCountry + a leaderboard snapshot
verify:
  - "npm run build"
  - "Manual: kicking the ball into a goal increments the tally"
---

# 21 — Goal detection + scoring wire

Connect detectGoal to scoreStore inside the tick, plus the `setCountry` inbound
handler. Emit `goalScored` so clients can celebrate and refresh the scoreboard.
