# Nimiq Space — Domain Language

Canonical names for cross-cutting concepts in the social space. Use these in code, UI
copy, and discussion. This file is a glossary only — no implementation details. The
seasonal soccer feature keeps its own glossary in [worldcup/CONTEXT.md](worldcup/CONTEXT.md).

## Self Interaction

**Action Wheel**:
The hexagonal menu that opens around your own avatar when you right-click (desktop) or
long-press (touch) yourself. The single entry point for self-actions. Its root level
offers Sectors; drilling into one opens a sub-wheel.
_Avoid_: radial menu, donut, self-menu, emote menu, pie menu.

**Sector**:
One of the six fixed edges of the Action Wheel hexagon. Each holds at most one action;
edges with nothing to show today are drawn as dim, non-interactive **reserved** Sectors
so the hexagon always reads whole.
_Avoid_: slice, wedge, segment, item.

**Emote Wheel**:
The sub-wheel reached by selecting the Emotes Sector — a ring of emote choices. Replaces
the old quick-emoji strip.
_Avoid_: emoji strip, emote menu.

**Flag Emote**:
The viewer's own chosen country flag, surfaced as the first (top, most prominent) choice on
the first page of their Emote Wheel so they can broadcast it like any other emote. Present
only when the viewer has chosen a country; it reuses the single per-player Country (the same
value the World Cup uses) and is selected from the Country Picker, now also reachable from
the player's own profile.
_Avoid_: nationality emote, country emoji.

**Games Wheel**:
The sub-wheel reached by selecting the Games Sector — choices for starting or joining a
game (e.g. World Cup: join the Free Play Field, start a Match).
_Avoid_: games menu, play menu.

**Hub**:
The transparent hexagonal center hole of the Action Wheel. A non-interactive window that
always frames your own avatar so the wheel reads as belonging to you.
_Avoid_: core, center button.

**Nav Sector**:
The dedicated bottom (6 o'clock) edge of the Action Wheel hexagon. Shows Close at the root
level and Back inside a sub-wheel; reused rather than adding a second nav Sector.
_Avoid_: close button, back button, hub button.

## Movement

**Touch Joystick**:
The on-screen left-thumb virtual stick on touch devices / the Nimiq Pay mini-app while on the
soccer pitch. It is *floating*: it has no fixed home — it materializes wherever the thumb presses
down and is dragged, anchored at that point. Held, it steers the player continuously in the pushed
direction; released, it stops. Coexists with tap-to-move: a quick stationary tap still walks, a
drag past a small threshold becomes the stick.
_Avoid_: d-pad, controller, analog stick, dpad, fixed stick.
