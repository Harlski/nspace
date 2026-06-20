---
id: "50-goalies-field"
milestone: M5
depends_on: []
triage: ready-for-agent
status: todo
acceptance:
  - server/src/worldcup/goalie.ts exposes a pure goalie step (kicker target + blocker collision)
  - WORLDCUP_GOALIE_MODE=kicker|blocker switches behaviour at runtime (default kicker)
  - both goals in the Free Play Field are defended; goalie touches never credit a wallet
  - client renders a Goalie at each goal, position synced from the server
verify:
  - "npm test -w server (new worldcup-goalie test + extended worldcup-ballPhysics test)"
  - "npm run build"
  - "manual: kick at goal in the field — keeper challenges; flip WORLDCUP_GOALIE_MODE and feel both"
---

# 50 — Goalies on the Free Play Field

## What to build

Add a **Goalie** to each goal in the **Free Play Field** that makes scoring meaningfully
harder but stays beatable (aim wide of it, or shoot hard). Ship **two behaviour models**
selectable by config so we can A/B which feels best and delete the loser:

- **kicker** — the Goalie is a server-controlled defender that tracks the ball laterally
  near its goal line and clears it using the existing proximity-kick.
- **blocker** — the ball is repelled off the Goalie like a solid moving obstacle.

The Goalie is server-authoritative and rendered on every client. A goal that merely
deflects off a Goalie must credit **nobody** (no leaderboard credit, no reward), so the
keeper is marked with a sentinel identity that can never be the credited last-kicker.

This is the feel-test prototype baked into the real feature, so land it first.

## Acceptance criteria

- [ ] Goalie behaviour lives in a pure, unit-tested function; difficulty is tuned by
      move-speed, reach, and reaction lag constants.
- [ ] `WORLDCUP_GOALIE_MODE` switches between `kicker` and `blocker` without a rebuild.
- [ ] Both Free Play Field goals are defended; a Goalie is rendered at each.
- [ ] A goal off a Goalie deflection (and any own-goal off a clear) credits no wallet.
- [ ] Players can still score with good aim/power; the keeper does not make scoring
      impossible.
- [ ] `npm run build` and `npm test -w server` pass.

## Blocked by

None - can start immediately.
