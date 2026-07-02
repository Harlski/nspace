# Teleporter Landing Hint with Join Spawn fallback

Teleporters store a **Teleporter Landing Hint** — a preferred floor tile in the destination
Room — not a guaranteed arrival coordinate. At warp time the server tries the hint first;
if that tile is no longer a legal feet landing, the player lands at the room owner's
**Join Spawn** (then the room's default spawn chain). Configuration is permissive (in-bounds
walkable hint); resolution is strict at use time.

We rejected strict configure-time validation (`canPlaceTeleporterFoot` on the destination)
because room layouts change after a teleporter is saved — blocking configuration of occupied
tiles and failing silently when blocks are placed on a saved destination were both worse than
hint-plus-fallback. We also rejected using per-player saved spawn as fallback: teleporters are
room infrastructure; the owner's Join Spawn is the right default when a hint fails.

Hub destinations remain a special case: always Hub default spawn, no tile picker.

Future readers seeing `targetX`/`targetZ` on the wire should treat them as hints, not
contracts.
