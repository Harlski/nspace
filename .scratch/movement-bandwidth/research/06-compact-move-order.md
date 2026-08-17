# Compact encodings for Path Playback `moveOrder`

**Date:** 2026-08-18  
**Scope:** Throwaway size estimate only. No production changes.  
**Script:** `node .scratch/movement-bandwidth/compact-path.mjs`  
**Wire today:** `server/src/moveOrderBroadcast.ts` (`buildMoveOrderOutMsg`), path from `conn.pathQueue` (`rooms.ts` `full.slice(1)` after `pathfindTerrain`).

## Verdict

**not worth it until full-state is gone**

Delta-tile JSON can cut a typical 8-waypoint `moveOrder` from **348 B to 177 B** (stacked with omit-speed + compact address: **159 B**). That is a real, linear win. It is still the wrong next slice.

One `chatTyping` full roster `state` at N=20 is **9.1 KiB payload, 178 KiB server egress**. One 8-waypoint `moveOrder` is **348 B payload, 6.8 KiB egress**. Typing is **O(N²)** in roster size; compacting paths is **O(path length)** per walk, then **O(N)** fan-out. Stopping `broadcastRoomStateFull` on typing (already the rewind trigger) saves about **4.7×** more bytes/min in a 20-player social hub than stacking every safe `moveOrder` trick, and it does not need a new path codec.

After full-state is gone, **delta tiles** is the only encoding with a slope worth revisiting (about **4.4 B/waypoint** vs **25 B/waypoint** for `{x,z,layer}` objects). Flattening, dropping `speed`, and stripping address spaces are envelope noise.

---

## Production shape (what we measured)

Click-to-walk `moveOrder` is:

```json
{
  "type": "moveOrder",
  "address": "NQ97 4M1T 4TGD VC7F LHLQ Y2DY 425N 5CVH M02Y",
  "path": [{ "x": 11, "z": 4, "layer": 0 }, "..."],
  "startX": 10.25,
  "startZ": 4,
  "startAtMs": 1720000000123,
  "speed": 5
}
```

Facts that constrain encodings:

- **Path tiles are integers.** Terrain A* is cardinal (`DIRS4` in `grid.ts`). Each remaining step is typically `±1` on one axis. Layer is `0 | 1`; ramps change layer on an adjacent tile, not on the start tile.
- **`path` is the remaining queue**, not the full A* path: `conn.pathQueue = full.slice(1)`. The first waypoint is the **next** tile. The start tile is **not** in `path`.
- **`startX` / `startZ` are floats** when the click happens mid-tile. Idle avatars sit on integer tile centers; a 50 ms tick at `MOVE_SPEED = 5` moves **0.25** units, so mid-walk starts like `10.25` are typical. Path Playback **must** have that origin (see `server/test/moveOrderStaleStart.test.ts`).
- **`speed` is always `DEFAULT_PATH_MOVE_SPEED` (5)** on this builder (`speed ?? DEFAULT_PATH_MOVE_SPEED`). Nothing else on the grid walk path passes a custom speed today.
- Addresses on the wire are the JWT `sub`, usually the **grouped** 44-character form (8 spaces). Compact is 36 characters.

World Cup free-move is a single **float** waypoint, not integer tiles. These encodings do not apply there.

Envelope with an empty `path` is **149 B**. Short walks are mostly envelope.

---

## Unit sizes (UTF-8 `JSON.stringify`)

Cardinal L-shaped remaining path from start tile `(10,4)`, pose `(10.25, 4)`. 20- and 40-waypoint paths include one layer change (ramp). First waypoint is never the start tile.

| Waypoints | Current | Flat `[x,z,l,…]` | Delta `"d":[dx,dz,…]` | Omit `speed` | Compact address | Drop `startX/Z` (invalid) | Stacked safe |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 2 | 198 | 162 | 153 | 188 | 190 | 172 | 135 |
| 8 | 348 | 204 | 177 | 338 | 340 | 322 | 159 |
| 20 | 651 | 291 | 239 | 641 | 643 | 625 | 221 |
| 40 | 1159 | 439 | 319 | 1149 | 1151 | 1133 | 301 |

`path[]` objects alone: 51 / 201 / 504 / 1012 B.

**Stacked safe** = delta tiles + omit `speed` + compact address, **keeping `startX` / `startZ` / `startAtMs`**. Round-trip of flat and delta is checked in the script.

Slope after the 2-waypoint envelope:

| Encoding | Bytes / extra waypoint |
|---|---:|
| Current `{x,z,layer}` | ~25.3 |
| Flat triples | ~7.3 |
| Delta pairs (layer sparse) | ~4.4 |

---

## Per-trick notes

### 1. Current JSON

Baseline. 8 waypoints: **348 B**. 40 waypoints: **1159 B** (path objects dominate).

### 2. Flat arrays

`"path":[11,4,0,12,4,0,…]`. Saves the repeated keys. 8 wp: **348 → 204 B** (−144 B). Still linear in waypoint count with a ~7 B slope.

### 3. Delta tiles from start

`"d":[1,0,1,0,…]` from `snap(startX,startZ)` (production `Math.round`). Layer omitted while it stays `0`; a change is `"lc":[[i,1]]`. 8 wp: **348 → 177 B** (−171 B). Best slope. Cardinal steps stringify as `1,0` / `0,1` / `-1,0` / `0,-1`.

This is the only encoding that would still matter after the envelope is the leftover cost.

### 4. Drop `startX` / `startZ` if the first waypoint is the start tile

**Does not apply.** `path[0]` is the next tile (`full.slice(1)`), and start is often mid-tile (`10.25` vs tile `10`). Forced omit saves **26 B** and would break Path Playback (avatars would start at the next tile center, or at a stale last snapshot). Do not do this. Start floats stay.

### 5. Omit `speed` when it equals 5

**10 B** (`,"speed":5`). Client already defaults to `DEFAULT_PATH_MOVE_SPEED`. Fine as a one-line optional field later; not a slice.

### 6. Compact address (strip spaces)

**8 B**. Same 8 spaces sit on every `state` player too. If you ever compact addresses, do it once for the whole protocol, not only on `moveOrder`.

---

## vs stopping full `state` on typing

Assumptions match the sibling estimator: 4 walks/player/min at **8 waypoints**, 8 typing full-states/min (on+off), fan-out = `payload × N`. Loaded `PlayerState` includes aliases + four cosmetics.

| N | Full `state` | 8wp `moveOrder` | Egress / one typing | Egress / one walk | Walks/min now | Walks/min stacked | Typing/min full | Typing/min slim presence |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 10 | 4561 B | 348 B | 44.5 KiB | 3.4 KiB | 136 KiB | 62 KiB | 356 KiB | 10.5 KiB |
| 20 | 9098 B | 348 B | 178 KiB | 6.8 KiB | 544 KiB | 248 KiB | 1422 KiB | 21 KiB |
| 30 | 13634 B | 348 B | 399 KiB | 10.2 KiB | 1223 KiB | 559 KiB | 3196 KiB | 31 KiB |

At N=20:

- Stacking every **safe** path trick saves **~295 KiB/min** of walks.
- Replacing typing full `state` with a 134 B presence `stateDelta` saves **~1401 KiB/min**.
- One typing event is still **~26×** one 8-waypoint order (178 KiB vs 6.8 KiB egress).

Even the long-walk extreme (every walk 40 waypoints) only brings compact-path savings into the same order of magnitude as the typing tax. Typical clicks are not 40 tiles (8 s at 5 u/s).

`chatTyping` is `broadcastRoomStateFull` in `rooms.ts` (~line 9566). That is both the bandwidth fire and the occupied-room rewind trigger (stale roster pose after Path Playback drains). Compact `moveOrder` does not touch that.

---

## What not to build

- A new `moveOrder` schema (flat, delta, or short keys) while presence events still dump the roster.
- Dropping start floats, or treating `path[0]` as the origin.
- Direction-bit or protobuf packing of paths. After deltas, the remaining ~4 B/waypoint is below the cost of a codec, and `FUTURE_PROTO` already deferred binary.

Revisit **delta tiles only** once presence is a one-player `stateDelta` and captures (`WS_METRICS_INTERVAL_MS`) show 20–40 waypoint orders dominating leftover egress.
