# Tutorial Room uses a south→north portrait path

The **Tutorial Room** is a first-contact lesson for **Portrait Play** / Nimiq Pay, not a
square social plaza. We author it as a **Tutorial Path**: a portrait-proportioned corridor
(about **7 wide × 15 deep**) that learners walk **south → north** through three bands —
**Mine**, **Pay** (**Unlock Pad**), **Exit** — matching the **Tutorial Step Coach** order.

We chose this over a square room or a southwest→northeast diagonal because a linear
south→north path reads clearly on a phone, keeps concurrent learners from scattering, and
makes the next beat obvious without in-world signposts. Layout stays existing block shapes
only (cubes, gold pyramids for **Tutorial Mine Slots**, sparse hex/half accents); no
billboards in v1.

**Considered options:** square bounds (current bootstrap) — weak portrait framing;
SW→NE diagonal — scenic but harder to read and author; wider plaza — more concurrent space
but dilutes guided progression.

Future template edits should preserve the portrait corridor and band order unless this ADR
is revisited. Authoring remains **Tutorial Staging** → publish **Tutorial Template**; the
bootstrap shell should match this shape so a fresh deploy is already on-path.
