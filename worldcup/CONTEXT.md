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

**Play Space**:
A private, invite-only, ephemeral room opened from a shareable `nimiq.space/join/{slug}`
link (and QR). Multiple people can join — the wallet **creator** plus up to a capped number
of **Guests** — and anyone inside can raise their own 1v1 Challenges. The link is shared by
any occupant. The space lives until the last member leaves (or its TTL lapses), surviving
even while everyone is away in a Match it spawned. Guests are confined to it; the creator
comes and goes freely. **All occupants** may build and edit inside the space for the
session only; those changes are not written back to the template or source room and are
destroyed when the Play Space closes.
_Avoid_: invite lobby, direct invite, staging room, waiting room.

**Ephemeral Session Edits**:
Build and layout changes any occupant may make inside an open Play Space — place, move,
remove, and recolor within the room bounds, same as a normal editable room. Changes exist
only for that Play Space instance and are discarded on teardown — never persisted to the
**Play Space Template**, **Template Source Room**, or world state files. Teleporters and
gates may not be placed — guest confinement must hold for the whole session.
_Avoid_: temporary save, draft room, sandbox mode.

**Play Space Template**:
An admin-managed layout preset that seeds new Play Spaces. It is not in the public room
catalog and cannot be entered on its own — a player only experiences it by **creating a
Private Room** (Play Space) that is seeded from that template. Admins create templates by
snapshotting a live room’s **Build Shell**; there is no separate “promote to official room”
path. Exactly one template is the **Default Play Space Template** — ordinary creators use
it automatically with no picker. System admins may choose any template when creating a Play
Space. All creation paths share one template pool (not split by activity).
_Avoid_: invite template, lobby template, official room clone, room template (ambiguous
with the design catalog).

**Default Play Space Template**:
The Play Space Template applied when a non-admin creator opens a new Play Space. Only one
template may be default at a time.
_Avoid_: default lobby, default invite layout.

**Archived Play Space Template**:
A template retired from active use. It cannot be chosen for new Play Spaces or set as default
but remains in the admin library and can be unarchived.
_Avoid_: deleted template, hidden template.

**Build Shell**:
The portable part of a room’s layout copied into a Play Space Template: bounds, placed
blocks, floor tints and removals, background, and join spawn. Excludes teleporters, gates,
signboards, billboards, voxel text, and per-player spawns.
_Avoid_: full snapshot, official room (templates are not catalog rooms).

**Template Source Room**:
The live room a Play Space Template was permanently bound to when the template was created
(or when an admin last reassigned its source). Any room with a persisted **Build Shell**
may serve as a source — player-owned, official, or built-in — but not ephemeral rooms
(Play Spaces, Match Pitches). **Resync** replaces the template’s stored layout with that
room’s current build state. Resync affects **future** Play Spaces only — already-open
spaces keep the layout they were seeded with. If the source room is deleted or otherwise
unavailable, the template keeps its last synced layout; **Resync** is disabled until an
admin reassigns a new source.
_Avoid_: linked room, parent room, master room, official room.

**Guest**:
A temporary, named identity (`guest:{id}`) minted when someone opens a Play Space link
without a wallet. Guests live only inside their Play Space and the Match Pitches it launches,
and are **never eligible for NIM rewards**. A guest may optionally upgrade to a wallet while
keeping the same identity.
_Avoid_: visitor, anon, temp user.

**Join gate**:
The identity screen at a Play Space join link before anyone enters the room. It shows who
you are joining (host), saved wallet accounts when present, or a sign-in vs guest choice;
a guest slot is claimed only after the visitor commits (wallet pick, wallet sign-in, or
guest nickname confirm).
_Avoid_: invite splash, join splash, redeem screen.

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
bubble and see a "Match starting in N…" overlay in the origin room before the server teleports
them onto the Match Pitch. A disconnect/leave during the countdown aborts the Match.
_Avoid_: warmup, pre-game, lobby.

**Crowd Allegiance**:
Which flag each section of the stadium crowd waves. On a Match Pitch the stands split by side
(side a's half waves a's flag, side b's the other). On the Free Play Field they reflect the live
roster — the distinct countries of players currently on the pitch — falling back to the champion
flag when nobody has picked.
_Avoid_: crowd colors, fans, supporters.

**La Ola**:
The Mexican wave: a single crest of standing, hands-up (🙌) spectators that travels
continuously around the whole stadium ring, looping a few times before petering out. Fires
on a slow ambient timer during calm and is distinct from the everyday ambient cheer (a
quick per-stand jump ripple) and the goal eruption (whole crowd jumps at once). A goal
always cancels an in-progress La Ola.
_Avoid_: the wave (ambiguous with the ambient cheer), stadium wave, ripple.

**Pitch Movement Mode**:
On touch devices / the Nimiq Pay mini-app, how an active player steers on the Free Play Field or
a Match Pitch — either **Tap** (stationary tap walks; drag does not summon the Touch Joystick) or
**Joystick** (drag summons the floating Touch Joystick; taps do not walk). Defaults to Tap;
the player's last choice persists locally across visits.
_Avoid_: control scheme, input mode, movement setting.

**Movement Mode Toggle**:
The small experimental top-left control (touch / Pay hosts only, active players on pitch rooms
only) that switches Pitch Movement Mode between Tap and Joystick. Shows the active mode label
(`Tap` or `Stick`); switching stops any in-progress walk or stick session immediately. Sits
under the top HUD chrome, stacking below the Match HUD bar when that bar is visible.
_Avoid_: joystick button, controls menu, settings panel.

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

**Match Result Overlay**:
The centre-screen card shown on the Match Pitch when a Match ends. Both sides' identicons appear
side by side — the winner at full opacity, the loser faded (on a Draw, both stay full). A
personalized headline for each participant ("You win!" / "You lost" / "Draw" / opponent-left
copy); Spectators see neutral copy. Final score below the identicons; a "Returning in N…"
countdown; and a Leave button (participants: **Leave**; Spectators: **Stop watching**) to return
to the snapshotted origin room early. Movement is frozen for the full linger; the scoreboard bar
stays visible with the final score. Auto-teleport home when the linger expires.
_Avoid_: result screen, end card, victory screen, post-match modal.

**Golden Goal**:
Sudden-death extra time after a tied Match timer — the next goal wins, capped at 90s after
which the Match is a Draw.

**Contested**:
The condition for **full-rate** NIM on a Free Play Field goal: at least two distinct
players present in the field at the moment of the goal. With only one player present, a
goal may still pay at a reduced rate (see **Solo Goal**).
_Avoid_: legitimate, valid.

**Solo Goal**:
A Free Play Field goal scored while exactly one distinct player is on the pitch. Eligible
for a reduced NIM payout — half the amount that would have been drawn for a full-rate goal
(`floor(amount / 2)`). Still requires a credited **Last Real Kicker**.
_Avoid_: practice goal, warmup goal.

**Paid Goal**:
A Free Play Field goal that meets attribution rules and queues a NIM payout to the **Last
Real Kicker** — at full rate when **Contested**, at reduced rate for a **Solo Goal**.

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

**Ball Edge Marker**:
A screen-edge HUD chevron pointing toward the ball when it is off-screen. Opacity scales
with how far past the viewport edge the ball sits (strong when far off-screen, fading as it
nears the frame). Shown only while the ball is outside the letterboxed game viewport;
hidden the moment any part of the ball enters frame. Stays visible through kickoff freezes
and overlays whenever the ball remains off-screen. Active players on the Free Play Field
or a Match Pitch only — never Spectators.
_Avoid_: off-screen indicator, ball compass, edge arrow.
