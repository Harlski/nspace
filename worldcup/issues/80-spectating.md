---
id: "80-spectating"
milestone: M8
depends_on: ["71-match-rules"]
triage: ready-for-agent
status: todo
acceptance:
  - on Match start a "{identicon} vs {identicon}" portal appears in the room it was started from
  - clicking/tapping the portal places the user in the Match Pitch stands (soft cap, "full" state)
  - Spectators see the live Match but are excluded from the kick set (cannot touch the ball)
  - Spectators return to origin on Match end; the portal is removed when the Match ends
verify:
  - "npm run build"
  - "npm test -w server"
  - "manual: start a 1v1, have a third client click the vs portal, watch from the stands, confirm they cannot affect the ball, and that they return when the match ends"
---

# 80 — Spectating a Match

## What to build

Let bystanders watch a live **Match** from the **stands**. When a Match starts, a clickable
**"{identicon} vs {identicon}"** portal appears in the room the Challenge was accepted in
(room-local). Clicking/tapping it drops the user into the Match Pitch's stands.

Spectators are present in the Match Pitch room but are **excluded from the proximity-kick
set**, so they can never affect the ball. They see the live ball, players, goalies, score,
and clock. A soft cap limits Spectators per Match; once reached the portal shows "full".
When the Match ends, Spectators are returned to their snapshotted origin and the portal is
removed.

Reuse the ephemeral-room lifecycle + origin-return helper from `70` and the Match state feed
from `71`.

## Acceptance criteria

- [ ] A "vs" portal labelled with both players' identicons appears in the origin room on
      Match start and is removed on Match end.
- [ ] Clicking/tapping the portal enters the stands; mouse and touch both work.
- [ ] Spectators render in a stands zone outside the pitch and cannot kick or move the ball.
- [ ] Spectators see the live Match (ball, players, goalies, score, clock).
- [ ] A soft cap (default 20) is enforced; the portal reflects a "full" state.
- [ ] Spectators are returned to origin when the Match ends.
- [ ] `npm run build` and `npm test -w server` pass.

## Blocked by

- 71-match-rules
