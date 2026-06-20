# World Cup — Soccer Domain

Glossary for the seasonal soccer feature (feature-flagged under `*/worldcup/`). Terms here
are the canonical names to use in code, UI copy, and discussion. This file is a glossary
only — no implementation details.

## Language

**Free Play Field**:
The single shared open pitch (room id `field`) anyone can join to kick the ball around.
Goals here count toward the daily country/player leaderboard and (new) earn NIM.
_Avoid_: arena, stadium, the field room.

**Match**:
A 1v1 just-for-fun game between two players on a private pitch. No NIM rewards, no
leaderboard credit.
_Avoid_: game, duel, 1v1 (use "Match" in code; "1v1" is fine in player-facing copy).

**Match Pitch**:
The ephemeral room that hosts one Match. Created when a Challenge is accepted and torn
down when empty.
_Avoid_: arena room, private field.

**Challenge**:
An open "looking for a Match" intent a player raises while in a social room. Shown above
their avatar; another player accepts it to start a Match.
_Avoid_: invite, request, intent (reserve "intent" for the existing ephemeral-flag pattern).

**Goalie**:
A server-controlled defender stationed at each goal that makes scoring harder. Present in
both the Free Play Field and every Match Pitch.
_Avoid_: keeper, NPC, bot.

**Spectator**:
A user watching a Match from the stands. Cannot touch the ball.
_Avoid_: viewer, watcher, audience.

**Spectate Portal**:
The "{identicon} vs {identicon}" marker that appears in the room a Match was started from. Any
onlooker clicks/taps it to drop into that Match's stands as a Spectator. Removed when the Match
ends; shows a "full" state once the Spectator soft-cap is reached.
_Avoid_: watch button, viewer pillar, teleporter.

**Kickoff Countdown**:
The brief handshake-and-countdown moment after a Challenge is accepted: both players show a 🤝
bubble and see a "Match starting in 3…2…1" overlay in the origin room before the server teleports
them onto the Match Pitch. A disconnect/leave during the countdown aborts the Match.
_Avoid_: warmup, pre-game, lobby.

**Crowd Allegiance**:
Which flag each section of the stadium crowd waves. On a Match Pitch the stands split by side
(side a's half waves a's flag, side b's the other). On the Free Play Field they reflect the live
roster — the distinct countries of players currently on the pitch — falling back to the champion
flag when nobody has picked.
_Avoid_: crowd colors, fans, supporters.

**Outfield Margin**:
The small distance a player may step past the pitch edges so they can get fully behind a ball
pinned against a wall, rather than bouncing it off. Only player movement is widened; the ball's
collision walls stay at the true pitch bounds.
_Avoid_: sideline, out of bounds, buffer.

**Kickoff Reset**:
What happens after a goal in a 1v1 Match that doesn't end it: both players are snapped back to
their kickoff spawns, the ball and keepers re-centre, the Match clock pauses, and movement is
frozen for a short "Kickoff in 3…2…1" countdown before play resumes. A "GOAL!" banner (the
scoring side's flag + new score) flashes alongside it.
_Avoid_: respawn, restart, reset (bare).

**Golden Goal**:
Sudden-death extra time after a tied Match timer — the next goal wins, capped at 90s after
which the Match is a Draw.

**Contested**:
The condition under which a Free Play Field goal is eligible for a NIM reward: at least two
distinct players present in the field at the moment of the goal.
_Avoid_: legitimate, valid.

**Paid Goal**:
A Free Play Field goal that meets all reward guards and queues a NIM payout to the scorer.

**Last Real Kicker**:
The most recent **human** player to touch the ball, tracked separately from Goalie touches
(a Goalie touch never overwrites it). Whoever this is at the moment of a goal is credited —
even on a Goalie deflection or own-goal — for the leaderboard and any NIM reward. A goal
with no recent Last Real Kicker (the Goalie alone knocked it in) credits nobody.
_Avoid_: last toucher, last kicker (that term includes Goalie touches).

**House Keeper**:
The single fixed identicon identity every Goalie is drawn with (one stable seed for all
goals), shown as an identicon billboard with a subtle keeper ring so it can never be
mistaken for a player. It is a **visual identity only** — the Goalie is still server
authoritative and credits no goals.
_Avoid_: using it as a synonym for the Goalie role; it names the look, not the defender.
