# Action Wheel goes glyph-only with focus-revealed titles

The Action Wheel used to print a text label under every Sector's glyph and drew a
hard-cornered hexagon. We softened the hexagon (rounded corners, lighter dividers) and
**removed the inline Sector labels**, surfacing a Sector's name only when it becomes the
**Focused Sector** — shown as the **Sector Title** above the wheel — plus a **Wheel Title**
below the Nav Sector naming the sub-wheel you're inside. The goal was a calmer, less harsh
wheel that still reads whole.

On pointer/keyboard devices a Sector is focused by hover/focus and activated by one
click/Enter, so nothing changes for them. On **touch** there is no hover, so we made the
focus explicit: the **first tap focuses** a Sector (revealing its Sector Title) and a
**second tap activates** it. The **Nav Sector is exempt** — a single tap always Closes/Backs,
because making the escape hatch cost two taps is hostile.

We accepted the touch two-tap cost (and the loss of always-visible names) over the
alternatives — keeping labels on touch only, or showing no per-Sector name on touch — to keep
one consistent glyph-only presentation across devices. A future reader wondering "why no
labels, and why does touch need two taps?" should know this was deliberate, not an oversight
to be flattened back out. Note "arm" stays reserved for Deployables; the touch state is
"focus," never "arm."
