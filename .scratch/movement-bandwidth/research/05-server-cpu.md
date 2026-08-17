# Server CPU: movement sync (not bytes)

**Date:** 2026-08-18  
**Scope:** Analysis only. No production changes. Click-to-walk rooms vs World Cup pitch as a separate line.  
**Primary sources:** `server/src/rooms.ts` (`startRoomTick`, `broadcastTickStateIfAllowed`, `snapshotPlayers`, `playerToOutState`, `broadcast`, `filterPresenceOutMsgForViewer`), `server/src/playerPathPose.ts`, `server/src/pathPosition.ts` (`poseAlongPathAtTime`), `server/src/cutMovementStream.ts`, `server/src/cosmeticStore.ts`, `server/src/achievementStore.ts`.

**How to read numbers:** **O()** costs are certain from the code. Microsecond figures are **estimates** from a local Node 22 microbench on this machine (2026-08-18), labeled **est.** Production SQLite may be slower (more achievement rows, disk, lock contention with other queries).

---

## Verdict

Path Playback already removed the **bandwidth** of tick pose. It did **not** remove the **CPU** of noticing that pose changed.

Every 50 ms the tick still walks every connection and writes analytic pose onto `conn.player`. If anyone (human walker **or** Hub NPC) moved, the room is dirty. Every ~120 ms `snapshotPlayers` still rebuilds the full roster, including **per-player SQLite loadout + level**, then diffs, then often **sends nothing**. `replaceTickBroadcastBaseline` then calls `snapshotPlayers` **again** instead of cloning the array it already has.

On this machine, that snapshot pair is **~4 ms + ~4 ms est.** for 30 loaded wallets vs **~37 µs est.** for one `JSON.stringify` of a 30-player `state`. Fan-out stringify (30×) is **~1.1 ms est.** Cutting the wire stream saves the stringify/send, not the snapshot.

Presence `stateDelta` of 1 player (method B) is still the right **bandwidth / rewind** slice. For **CPU**, the bigger tick win is: do not run `playerToOutState` / SQLite on the whole roster just to decide that pose-only motion should stay off the wire.

---

## 1. Does the 50 ms tick still walk everyone and copy pose when `CUT_MOVEMENT_STREAM` means no WS send?

**Yes.** Cut-stream only gates **include in `stateDelta`**. It does not skip simulation or snapshot.

### Every 50 ms (`TICK_MS`), all rooms in `rooms`

`startRoomTick` registers `setInterval(..., TICK_MS)`:

```8495:8866:server/src/rooms.ts
export function startRoomTick(): void {
  // ...
  setInterval(() => {
    const now = Date.now();
    // ...
    for (const [roomId, room] of rooms) {
      // ...
      for (const c of room.values()) {
        // path step or analytic pose write
      }
      // NPCs ...
      broadcastTickStateIfAllowed(roomId, room, now, changed);
      // worldcup balls if this room has any
    }
  }, TICK_MS);
}
```

`TICK_MS = 50` at line 591. Comment at 592-595 already says simulation still runs every tick; `STATE_BROADCAST_MIN_MS` (default 120, lines 597-600) only limits **client** snapshots.

**O(R × P)** per 50 ms over occupied-or-ever-opened rooms × connections. Empty maps still iterate (last-leaver does not always `rooms.delete`).

### Pose copy on Path Playback rooms

`ANALYTIC_PATH_SKIP_STEPPING` is on whenever `MOVE_ORDER_BROADCAST` is on (default), unless env forces it:

```40:41:server/src/playerPathPose.ts
export const ANALYTIC_PATH_SKIP_STEPPING =
  process.env.ANALYTIC_PATH_SKIP_STEPPING === "1" || MOVE_ORDER_BROADCAST;
```

Per connection, if skip-stepping and not field-like:

```8570:8612:server/src/rooms.ts
        const isFieldFreeMove = worldcupIsFieldLikeRoom(roomId);
        const hadPathBeforeTick = c.pathQueue.length > 0;
        const skipStepping =
          ANALYTIC_PATH_SKIP_STEPPING &&
          c.pathQueue.length > 0 &&
          c.pathMove &&
          !isFieldFreeMove;
        // ...
        if (skipStepping) {
          const tickResult = tickAnalyticPathHuman({ player: c.player, ... });
```

`tickAnalyticPathHuman` **mutates** `conn.player` x/y/z/vx/vz and rewrites `pathQueue` from a from-start replay (`playerPathPose.ts` 117-154). `changed = true` if the body moved (8612). That is the “copy analytic pose” the question asked about. It happens whether or not a WebSocket frame follows.

Idle humans (empty queue, not field): still enter the loop, call `advanceAlongPathHuman` on an empty queue (cheap), then `resolveNearestTerrainNode` in a 3×3 (`8653-8682`). **O(P)** stance work every 50 ms even when nobody is walking.

### `poseAlongPathAtTime` is O(elapsed), not closed-form

```106:149:server/src/pathPosition.ts
export function poseAlongPathAtTime(...) {
  // clone start pose + full original path
  // while remaining > 0: stepHumanAlongPath in tickMs slices
}
```

**Certain:** **O(elapsed / 50 ms)** hypot steps per walker per tick, plus a full path clone. Name “analytic” is gameplay-authority branding, not O(1) math.

**Est. (this machine):**

| Call | µs / op |
|---|---:|
| 50 ms elapsed, 8 waypoints | ~1.6 |
| 1.6 s elapsed (end of typical 8-tile walk) | ~3 |
| 20 s elapsed, 20 waypoints | ~21 |
| 30 walkers × 1.6 s path, one tick | ~80 |

So pose replay is **small** vs the 50 ms budget (~0.2% for 30 typical walkers). Long AFK-click paths stay structurally quadratic-in-duration if you keep replaying from `startAtMs` every tick; they are not the current hotspot.

Stepped `advanceAlongPathHuman` is **O(1)** per walker per tick (`5510-5526`). Skip-stepping is **more** CPU than stepping for long walks, still usually < 0.1 ms.

### Cut-stream: no send, still snapshot + diff

```683:758:server/src/rooms.ts
function broadcastTickStateIfAllowed(...) {
  const want = dirty || pendingTickStateBroadcast.has(roomId);
  if (!want) return;
  if (now - last < STATE_BROADCAST_MIN_MS) { /* pend; return; no snapshot */ }
  const full = snapshotPlayers(roomId);
  // ... build changed via shouldIncludeInTickStateDelta({ enabled: CUT_MOVEMENT_STREAM, ... })
  if (changed.length === 0) {
    if (suppressedMovementOnly) replaceTickBroadcastBaseline(roomId);
    // ... return;  // no broadcast()
  }
  // else broadcast state or stateDelta, then replaceTickBroadcastBaseline
}
```

When all humans are grid-walking and presence fields are unchanged:

1. Tick pose write → `dirty = true`.
2. ~2 of every 3 fifty-ms ticks: min-interval return (no snapshot). **Est. ~0 extra** beyond pose.
3. Every ~120 ms: `snapshotPlayers` → equality + `shouldIncludeInTickStateDelta` (`cutMovementStream.ts` 78-101) → `changed = []` → **no `broadcast`** → `replaceTickBroadcastBaseline` which **snapshots again** (`667-671`).

`CUT_MOVEMENT_STREAM` (`cutMovementStream.ts` 8) equals `MOVE_ORDER_BROADCAST`. Field-like rooms pass `isFieldFreeMove` and **never** suppress (`74-76`, `92-97`).

Idle room, no NPC motion, `dirty = false`: `want` is false, **return at 696**. No snapshot, no stringify.

### Hub NPCs keep the snapshot hot

Default `FAKE_PLAYER_COUNT = 2` (853-856). Bots are **not** `ClientConn`s. Diff uses `conn?.pathQueue.length ?? 0` → 0 → not cut-stream eligible. A wandering NPC therefore:

- sets `changed`
- forces the 120 ms `snapshotPlayers` of **all humans** (SQLite)
- actually **sends** `stateDelta` (NPC pose)

NPC walk bursts (~5 tiles) plus `FAKE_IDLE_MS = 10_000` mean a populated Hub is dirty a non-trivial fraction of the time even if every human is standing.

---

## 2. How expensive is `snapshotPlayers` vs `JSON.stringify` of a 30-player state?

**Snapshot dominates stringify by ~100× (one encode) or ~4× (encode × 30 recipients), est.** The extra cost is SQLite inside `playerToOutState`, not the object spread.

### What `snapshotPlayers` does (certain)

```5546:5572:server/src/rooms.ts
function playerToOutState(conn: ClientConn): PlayerState {
  const base = conn.nimSendIntent ? { ...conn.player, nimSendAway: true } : { ...conn.player };
  applyCosmeticLoadoutToPlayer(base);
  refreshPlayerLevelOnPlayer(base);
  // typing / challenge / invis / frozen / worldcupCountry
  return base;
}

function snapshotPlayers(roomId: string): PlayerState[] {
  const humans = [...roomOf(roomId).values()]
    .filter((c) => !c.streamObserver)
    .map(playerToOutState);
  // NPC fakes: shallow { ...player } only (no SQLite)
}
```

`applyCosmeticLoadoutToPlayer` → `getPublicLoadoutForWallet` → `getLoadout` **SELECT** + up to **four** `getCatalogEntry` **SELECT**s (`cosmeticStore.ts` 868-902, 307-316, 953-968). Statements are `db.prepare(...).get(...)` **on every call** (not a cached `Statement`).

`refreshPlayerLevelOnPlayer` → `totalPointsForWallet` **SUM** over `achievement_completions` (`achievementStore.ts` 732-741) for every non-guest.

`worldcupGetPlayerCountry` is an in-memory map (`scoreStore.ts` 312-313): **O(1)**, noise.

Why tick does this: `tickPlayerStatesEqual` includes cosmetics, level, flags (`628-648`). The tick snapshot is also the wardrobe/level change detector. There is no “pose-only cheap pass.”

### Measured on this machine (est.)

Isolated better-sqlite3, 30 wallets, 4 equipped SKUs, 12 achievement rows each. Mirrors the **uncached prepare+get** pattern in production sources.

| Work | N=10 est. | N=20 est. | N=30 est. |
|---|---:|---:|---:|
| `playerToOutState` equivalent (6 queries), one wallet | ~0.14 ms | same | ~135 µs |
| `snapshotPlayers` humans only | ~1.3 ms | ~2.6 ms | **~4.0 ms** |
| Same ×2 (`snapshot` + `replaceTickBroadcastBaseline`) | ~2.6 ms | ~5.3 ms | **~8.2 ms** |
| Cached statements (not what the code does) ×1 | | | ~2.2 ms |

`JSON.stringify` of `{ type: "state", players }` with loaded players (~13.5 KiB UTF-8 at N=30):

| Work | est. |
|---|---:|
| stringify 10-player state once | ~12 µs |
| stringify 30-player state once | **~37 µs** |
| stringify 30-player **× 30 recipients** | **~1.1 ms** |
| stringify 1-player `stateDelta` once | ~1.5 µs |
| stringify 1-player **× 30** | ~44 µs |
| shallow clone 30 players | ~2 µs |
| `players.filter` identity | ~0.2 µs |
| `Buffer.byteLength` of 30-player JSON (after stringify) | ~43 µs if you stringify again; `broadcast` samples the first payload only (4503-4509) |

**Relative, N=30:** one snapshot ≈ **100×** one stringify; two snapshots ≈ **7×** a 30-way stringify fan-out. Cosmetics/level I/O is the tick CPU, not JSON.

Shallow `{ ...conn.player }` plus flag copies are **O(P)** and **~µs**.

### Dirty walking room, Path Playback, no WS pose (N=30)

- 20 Hz: pose write **~0.01-0.08 ms/tick est.**
- ~8.3 Hz: snapshot+diff+second snapshot **~8 ms est.** → **~67 ms/s** of event-loop time (~7% of one core) **with zero movement bytes**
- stringify/send: **0**

Kill-switch `MOVE_ORDER_BROADCAST=0` adds the ~1.1 ms stringify fan-out + 30 `ws.send`s of ~13 KiB **on top of the same snapshots** (`753-758` still `replaceTickBroadcastBaseline`). Cut-stream saves **~9 ms/s est.** of encode+send, not the **~67 ms/s** snapshot tax.

---

## 3. `broadcast()` stringifies per recipient. Identical for most viewers?

**Yes, stringify is per recipient. Yes, the JSON is identical for almost all viewers in a typical room.** One or two encodes (public vs admin) would match today’s semantics.

```4397:4513:server/src/rooms.ts
function filterPresenceOutMsgForViewer(roomId, msg, viewer): OutMsg | null {
  const isGameAdmin = isAdmin(viewer.address);
  if (msg.type === "state" || msg.type === "stateDelta") {
    const filtered = playersVisibleToViewer(viewerOpts, msg.players);
    const players = isGameAdmin ? filtered : filtered.map(stripAdminOnlyPresenceCues);
    return { ...msg, players };
  }
  // join/leave/moveOrder/moveAbort: drop invisible subjects for non-admins
}

function broadcast(roomId, msg, except?) {
  // spatial branch is terrain-only (see below)
  for (const [addr, c] of r) {
    const forViewer = filterPresenceOutMsgForViewer(roomId, msg, c);
    if (!forViewer) continue;
    const payload = JSON.stringify(forViewer);  // every recipient
    payloads.push({ c, payload, type: forViewer.type });
  }
  // metrics from payloads[0] size × recipients
  for (const { c, payload } of payloads) c.ws.send(payload);
}
```

`spatialFilteredOutMsgType` is **only** obstacle/floor deltas (`2098-2106`). Player `state` / `stateDelta` / `moveOrder` always take the per-recipient stringify loop. Spatial interest does **not** subset avatars.

`playersVisibleToViewer` always allocates a new array (`adminPresence.ts` 28-32) even if everyone is visible. Non-admins `.map(stripAdminOnlyPresenceCues)`; strip is identity if `adminInvisible` / `frozen` are unset (`4376-4390`).

`isAdmin` is a `Set` lookup (`config.ts` 19-21): **O(1)**.

**When payloads actually differ**

| Situation | Encode classes |
|---|---|
| No invisible, no frozen | **1** JSON for all viewers |
| Frozen and/or invisible flags present | **2**: admin (flags on) vs everyone else (stripped); non-admins omit invisible peers entirely (`filter` → `null` skip on join/order) |
| Mix of admins and players | still those two strings |

**Est. savings if stringify-once (or twice):** N=30 full `state` **~1.1 ms → ~0.04 ms** encode. Filter/map allocs stay **O(N × P)** and are **~tens of µs**.

On the Path Playback walking path there is often **no** `broadcast` at all, so stringify-once saves **0** there. It matters for:

- leftover `broadcastRoomStateFull` (typing, etc.)
- World Cup pose/ball/goalie fan-out
- NPC `stateDelta` ticks
- `moveOrder` / `moveAbort` (already small; **est. ~30 × 1-2 µs**)

---

## 4. CPU if presence events used `stateDelta` of 1 player instead of `snapshotPlayers` of N

Today those events call `broadcastRoomStateFull`:

```675:681:server/src/rooms.ts
function broadcastRoomStateFull(roomId: string): void {
  broadcast(roomId, { type: "state", players: snapshotPlayers(roomId) });
  replaceTickBroadcastBaseline(roomId);
}
```

Call sites (not exhaustive; see `research/02-full-state-triggers.md`): `chatTyping` 9566-9570, `nimSendIntent` 9560-9562, `setChallenge` 9597, chat send clearing typing 13420-13421.

Existing 1-player pattern (level-up, freeze): `playerToOutState(one)` + per-socket send (`1977-1980`, `5299-5313`). Freeze already stringifies a 1-player `stateDelta` per viewer and **merges one** baseline row instead of snapshotting the room.

### Per event, N=30 (est.)

| | Today full `state` | Method B: 1 loaded `stateDelta` | B+C slim presence (~129 B) |
|---|---:|---:|---:|
| SQLite `playerToOutState` | ~4 ms ×2 ≈ **8 ms** | **~0.14 ms** (once) | same or skip cosmetics |
| stringify × recipients | **~1.1 ms** | **~0.04 ms** | ~0.02 ms |
| `ws.send` payload size | ~13.5 KiB × 30 | ~480 B × 30 | ~129 B × 30 |
| **Total event-loop (encode+lookup)** | **~9 ms** | **~0.2 ms** | **~0.2 ms** |

**Certain O():** `O(N)` snapshot + `O(N × N)` encode of roster → `O(1)` snapshot of subject + `O(N)` encode of a constant-size delta.

**Ratio est.:** **~40-50×** less CPU per presence event at N=30; ~20× at N=10. Scales as dropping a quadratic encode plus dropping N SQLite round-trips.

**Per minute (ANALYSIS social-hub model, 10 full-state-like events/min, N=30):**

- Today: **~90 ms/min** (~1.5 ms/s) on presence sends
- B: **~2 ms/min**

So B is a **huge bandwidth** win and a **modest CPU** win **unless** the room is idle (no walkers, no NPC motion). In a walking or NPC-active Hub the tick snapshot (**~67 ms/s est.**) still dwarfs presence-event CPU. B does **not** remove that; it only removes the extra snapshot pair **on those events**.

Stringify-once on today’s full `state` would save ~1 ms/event, not the 8 ms SQLite.

---

## 5. World Cup pitch (separate line)

Field-like rooms (`worldcupIsFieldLikeRoom`, 7518-7521): Free Play Field and match pitches.

| Piece | Behavior | CPU (certain / est.) |
|---|---|---|
| Path | Straight 1-waypoint free-move (`10686-10728`); `RATE_MOVE_TO_FIELD_MS = TICK_MS` (50 ms joystick) | `moveTo` + optional `moveOrder` **O(P_moving)** per intent |
| Tick step | `skipStepping` is **false** (`8572-8576`). `advanceAlongPathHuman` **O(1)** / player | **est. < 50 µs** for 30 |
| Cut-stream | **Does not apply.** Pose stays in tick `state` / `stateDelta` | snapshot+stringify **on** |
| Ball | If `worldcupRoomHasBalls`: `playerPoseNow` per non-spectator (`8788-8801`) then `tickRoomBalls` **O(balls × P)** kicks + 1 `stepBall` (`ballTick.ts` 63-155) | **est. 0.05-0.3 ms/tick** with 1 ball; `playerPoseNow` on field is usually a field copy unless `pathMove` is set (then O(elapsed) again, typically 50 ms after last stick) |
| Goalies | 2 keepers, step + maybe `goalieState` every ≥ 250 ms (`7183-7267`) | **est. tens of µs** + small JSON |
| Tick wire | Movers fail equality → often `sendFull` when everyone is running (`750`) | **~8 ms snapshot + ~1.1 ms stringify + 30 sends** every ~120 ms → **~75 ms/s est.** at N=30 all moving |
| `moveOrder` dual-send | Still emitted on field `moveTo` (`10721`) at 20 Hz per stick | Worst case 30 players × 20 Hz × 30 encodes of ~200-400 B → **est. ~20-30 ms/s** extra encode; plus that many `ws.send`s |

Pitch **still streams pose** (product decision). Do not fold it into click-to-walk savings. CPU there is snapshot SQLite + real stringify/send + high-rate `moveOrder`, not path replay.

---

## Method CPU (companion to ANALYSIS bytes table)

None of this is patched. Bytes live in `ANALYSIS.md`; this is event-loop time.

| Method | Tick CPU | Presence-event CPU | Notes |
|---|---|---|---|
| **A. Today** (Path Playback + cut stream + full `state` on presence) | Snapshot **O(P)** SQLite ~8.3 Hz while dirty | **O(P)** SQLite + **O(N × P)** stringify | Walking/NPC rooms: snapshot is the load. Idle: cheap. |
| **B. Presence → 1-player `stateDelta`** | Unchanged | **~40-50×** less at N=30 est. | Ship for rewind/bytes. Existing freeze/level-up shape. |
| **C. Slim presence fields** | Unchanged | Encode even smaller; lookup same unless cosmetics omitted | Second-order CPU after B. |
| **D. Omit walker pose on leftover `state`** | Unchanged unless snapshot skips pose fields **and** SQLite | Avoids building unused floats; **µs** | Correctness, not CPU. |
| **Skip snapshot when only poseDirty** (not in ANALYSIS ship list; CPU-specific) | **Removes ~67 ms/s est.** at N=30 walking | n/a | Use tick `changed` + a presence-dirty flag; keep last pose in baseline without `getLoadout`. Biggest tick CPU win. |
| Cache loadout/level on `conn` | Snapshot becomes **O(P)** spreads **~µs** | Same | Invalidation on wardrobe / achievement. Also fixes prepare-every-call. |
| Clone `full` into baseline instead of second `snapshotPlayers` | **~2×** less SQLite on the tick path **certain** | `broadcastRoomStateFull` same | One-line structural waste at 667-671 / 758. |
| Stringify-once / twice (admin vs public) | 0 on cut-stream no-send | **~1 ms → 0.04 ms** on full `state` | Cheap follow-up. |
| **H. 1 Hz analytic heartbeat** | +1 snapshot-or-pose encode / s | n/a | If it goes through `snapshotPlayers`, add **~4 ms/s**. Pose-only from `conn.player` is **~tens of µs + small JSON × N**. |
| **I. Player spatial interest** | Filter **O(N × P_visible)**; **cannot** stringify-once | Same | More CPU than stringify-once; maybe less encode if views are small. High correctness cost (ANALYSIS). |
| **J. permessage-deflate** | **Adds** compress CPU per send (typically **0.2-2 ms est.** per 13 KiB) | Worse for tiny deltas | Bandwidth play; fights the event loop. `ws` has it off. |
| **K. Protobuf** | Encode maybe ~0.5-1× JSON | Same | Does not remove SQLite. Deferred. |
| **L. Re-stream pose every tick** | Same snapshots **plus** stringify ~8.3 Hz | n/a | Restores **~9 ms/s** encode+send; rejected for bytes/lag. |

---

## Other work on the same 50 ms timer (not movement-sync, competes)

Certain **O(placed tiles)** every tick: `tickClaimableBlockReactivations` walks every placed prop in every room (`3023-3056`); `tickExpiredGatesForRoom` walks that room’s placed map (`6453-6473`). Large built rooms can dwarf pose math. Billboard dwell is **O(P × billboards)** when ≥2 real players (`2904-2935`). Out of destination except as “tick is already busy.”

`recordGameWsOutbound` is a no-op unless `WS_METRICS_INTERVAL_MS` > 0 (`gameWsMetrics.ts` 35-44).

---

## O() summary

| Path | Certain complexity | Est. time (N=30, this machine) |
|---|---|---|
| 50 ms tick, walk all conns + write pose | **O(P)**; skip-step **O(P × elapsed/50 ms)** | ~0.01-0.08 ms walkers; idle stance **O(P)** |
| Cut-stream suppresses WS | **O(1)** extra vs snapshot; **does not skip** pose or snapshot | stringify **0** |
| `snapshotPlayers` | **O(P)** SQLite (loadout + SUM level) + spreads | **~4 ms** |
| `replaceTickBroadcastBaseline` | **O(P)** SQLite **again** | **+~4 ms** |
| `broadcast` player messages | **O(N)** stringify of payload **P_bytes**; payload often **O(P)** | full `state` **~1.1 ms**; 1-player delta **~0.04 ms** |
| Presence today | **O(P)** snapshot ×2 + **O(N × P)** encode | **~9 ms / event** |
| Presence method B | **O(1)** snapshot + **O(N)** encode | **~0.2 ms / event** |
| World Cup pitch tick wire | Same snapshot **plus** real pose stringify; balls **O(balls × P)** | **~75 ms/s** all-running + stick `moveOrder` **~20-30 ms/s** worst case |

**Bottleneck rank (click-to-walk Hub):** (1) `snapshotPlayers` SQLite while the room is dirty, (2) per-recipient stringify of leftover full `state` / NPC deltas / pitch pose, (3) pose replay (usually noise).
