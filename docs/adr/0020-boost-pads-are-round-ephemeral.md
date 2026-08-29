# Boost Pads are Tag Round ephemeral tiles, not Attention Markers

Boost Pads are glowing floor tiles the Holder can stand on for a temporary Path Playback speed boost. They spawn when a Tag Round starts and vanish when it ends. Spawn tiles are walkable floor with no placed block on that cell (passable ramps and stacked cubes count as occupied).

They are not **Attention Markers** (those are authorable, tile-keyed layout glyphs in the Build Shell, at most one V per tile). They are not placeable obstacles. Folding them into the layout layer would persist hunt chrome in the room after the Tag Round, ship them with templates, and collide with the “Attention Marker is never the thing you interact with” rule.

The Holder’s speed change is server-authoritative (the walk path already carries a speed). Cosmetic glow on the pad may be client render on a server-owned pad position.
