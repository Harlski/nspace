# Movement sync bandwidth analysis

**Date:** 2026-08-18  
**Repo:** `/home/johd/Projects/nspace`  
**Wayfinder map:** [map.md](map.md)  
**Estimator:** `node .scratch/movement-bandwidth/estimate-baseline.mjs` (loaded upper bound); cited sizes: [research/01-wire-baseline.md](research/01-wire-baseline.md) (`measure-wire-baseline.mjs`, actual `playerToOutState`)  
**Related diagnosis:** Path Playback rewind in occupied rooms (`/tmp/nspace-path-playback-rewind-handoff.md`)

This is an **estimate from the live wire format**, not a production packet capture. Sizes are UTF-8 `JSON.stringify` bytes (the same encoding `broadcast()` uses). WebSocket has **no permessage-deflate** today (`WebSocketServer` in `server/src/index.ts` does not enable it).

---

## What was done

1. Charted a wayfinder map under `.scratch/movement-bandwidth/` (destination: cited 10/20/30 baseline + a no-teleport recommendation, not a protocol rewrite).
2. Read the golden paths: `rooms.ts` tick + `broadcastTickStateIfAllowed`, `cutMovementStream.ts`, `moveOrderBroadcast.ts`, `playerPathPose.ts`, client `Game.syncState` / Path Playback.
3. Measured realistic JSON payloads and fan-out (`payload × N` recipients).
4. Spun worker agents to re-measure, catalog full-`state` triggers, compare methods, draft a poor-connection contract, estimate tick CPU, and try compact `moveOrder` encodings. Their notes land under `research/` as they finish; this file is the synthesis.
5. Locked grill recommendations (user asked the agent to choose): keep Path Playback; stop full-roster `state` on presence events; never rewind playback from a stale snapshot; do not stream pose every frame for laggy clients.

---

## How movement is sent today

Simulation runs every **50 ms** (`TICK_MS`). Clients receive pose snapshots at most every **120 ms** (`STATE_BROADCAST_MIN_MS`) and only when something is dirty.

**Path Playback is already on** (`MOVE_ORDER_BROADCAST` unless set to `"0"`):

- On a validated walk the server broadcasts one `moveOrder` (path + `startAtMs` + speed). Clients animate along that path.
- Tick `stateDelta` **omits pose** for active grid walkers (`CUT_MOVEMENT_STREAM`). Presence fields can still delta.
- World Cup pitch **free-move still streams** velocity snapshots. This analysis targets click-to-walk rooms.
- Player `state` / `stateDelta` / `moveOrder` are **room-wide**. Spatial interest filters terrain deltas only, not avatars.

The remaining hot path in a busy social room is **not the 20 Hz tick**. It is **full `state` (entire roster, including `x/y/z/vx/vz`, cosmetics, `recentAliases`)** on events such as `chatTyping`, `nimSendIntent`, `setChallenge`, chat send after typing, and several World Cup / teleport / rename paths. Achievement level-up already sends a **one-player `stateDelta`**; typing does not. That inconsistency is both a bandwidth bug and the occupied-room rewind trigger (stale `conn.player` pose overwrites Path Playback after the client has drained the order). Call-site catalog: [research/02-full-state-triggers.md](research/02-full-state-triggers.md). Hub NPCs (`roomFakePlayers`) are not cut-stream eligible, so a couple of wanderers can still tick `stateDelta` at ~8 Hz.

Fan-out is `O(N²)` for a full roster: one ~`N × 244 B` JSON blob (actual idle `playerToOutState`; loaded cosmetics/aliases closer to 395 B), stringified **per recipient** after the admin-invisibility filter, sent to all `N` sockets.

---

## Unit sizes (UTF-8 JSON)

| Payload | Bytes |
|---|---:|
| Lean player (hypothetical 7 fields) | 117 |
| Actual idle `playerToOutState` (empty aliases, 4 cosmetic `null`s, level) | **244** |
| Loaded (3 aliases, preset ids, country, pay) | 395 |
| Full `state`, N=10/20/30 actual idle | **2478 / 4928 / 7378** |
| Full `state`, N=10/20/30 loaded | 3988 / 7948 / 11908 |
| `stateDelta` of **one** actual walker | 281 |
| Presence-only delta (`address`, `displayName`, `chatTyping`) | ~129 |
| `moveOrder`, 2 / 8 / 20 waypoints | 196 / 346 / 646 |
| `moveAbort` | 111 |

A Nimiq address with spaces is 44 characters and dominates small messages. `recentAliases` (even `[]`) and four cosmetic keys (often `null`) ride along on **every** human snapshot. Detail: [research/01-wire-baseline.md](research/01-wire-baseline.md).

---

## Baseline: per event and per tick

**Per simulation tick (50 ms):** 0 movement WebSocket bytes under Path Playback, even if everyone is walking. The tick still copies analytic pose into `conn.player` and, when anyone walked, marks the room dirty. Every ~120 ms `snapshotPlayers()` still runs to **compare**; if only pose changed, the send is suppressed. So walking rooms keep some **CPU** without the old **bandwidth**.

**Per state-broadcast opportunity (~120 ms), all N walking:**

| Mode | N=10 payload | N=10 server egress | N=20 egress | N=30 egress |
|---|---:|---:|---:|---:|
| Path Playback (today, pose cut) | 0 | 0 | 0 | 0 |
| Kill switch `MOVE_ORDER_BROADCAST=0` (all movers changed → full `state`, actual idle) | 2.4 KiB | **24 KiB** | **96 KiB** | **216 KiB** |

That last row is ~8.33 times per second: about **12 / 47 / 105 MiB/min** server egress if a whole room is walking on the old stream (actual idle payloads). Path Playback already removed that.

**Per social event that still calls `broadcastRoomStateFull` (actual idle roster):**

| N | Payload | Server egress (one typing toggle) | Per client |
|---|---:|---:|---:|
| 10 | 2.4 KiB | **24 KiB** | 2.4 KiB |
| 20 | 4.8 KiB | **96 KiB** | 4.8 KiB |
| 30 | 7.2 KiB | **216 KiB** | 7.2 KiB |

Same cost as a legacy all-movers tick, but fired by chat, pay-intent, challenge, rename, etc. Empty rooms almost never hit these; occupied Commons/Hub hit them constantly. That matches the rewind report (alone ≈ never; with others ≈ obvious).

---

## Baseline: 60-second occupancy model

Assumptions (stated so they can be replaced with `WS_METRICS_INTERVAL_MS` captures later):

- Click-to-walk room, Path Playback on.
- **Social hub:** 2 walks per player per minute (8-waypoint `moveOrder`), plus **8 typing full-states/min** and **2 other full-states/min** (challenge / pay intent / chat-clear-typing).
- **All walking:** 4 walks per player per minute, no social full-state.
- **Idle:** everyone standing, no presence events.

The table below used **loaded** player JSON as an upper bound (`estimate-baseline.mjs`). Scale by ~0.55 for actual idle wallets ([research/01-wire-baseline.md](research/01-wire-baseline.md)); ranking of scenarios does not change.

| Scenario | N=10 server | N=20 server | N=30 server | N=30 per client |
|---|---:|---:|---:|---:|
| Idle | 0 | 0 | 0 | 0 |
| All walking, Path Playback only | 0.15 MiB/min | 0.57 MiB/min | 1.3 MiB/min | 44 KiB/min |
| All walking, **legacy pose stream** | 22 MiB/min | 86 MiB/min | **193 MiB/min** | 6.4 MiB/min |
| **Social hub, today** | 0.51 MiB/min | 2.0 MiB/min | **4.5 MiB/min** | 154 KiB/min |

At N=30, **~80% of social-hub egress is full `state`**, not `moveOrder`. Walks scale as `O(N²)` too (each order goes to everyone), but each order is ~373 B vs ~13 KiB for a roster dump.

Per-second social hub today: roughly **9 / 35 / 79 KiB/s** server for N=10/20/30. Modest next to video, ugly next to Path Playback's intent, and **quadratic** as the Hub fills.

---

## What was tried (methods)

Workers and the local estimator compared the following. None of these were patched into production in this session. Method tables: [research/04-method-comparison.md](research/04-method-comparison.md) (`compare-methods.mjs`; that run used 4 walks/player/min so today's N=30 social line is ~3.7 MiB/min, not the loaded-upper-bound 4.5).

| Method | Verdict | Why |
|---|---|---|
| **A. Today** (Path Playback + cut stream + full `state` on presence) | Baseline | Tick pose already gone; occupied-room full `state` remains. |
| **B. Presence → `stateDelta` of one loaded player** | **Ship first** | Same pattern as achievement level-up. N=30 social hub ~4.5 → ~0.78 MiB/min. Also removes most rewind triggers. |
| **C. B + presence-only fields** (no pose, no cosmetics unless they changed) | **Ship with B** | Extra ~10–15% after B. Presence delta ~129 B vs ~480 B. |
| **D. Omit pose from any remaining full `state` for active walkers** | **Ship with B/C** | Closes the rewind window if something still sends `type:"state"`. |
| **E. Slim pose message / compact keys** | **Rejected as a tick stream** | Bringing 120 ms pose back, even slim, is **+376% to +884%** vs today. Compact keys on leftover presence are tiny. |
| **F. Round coords to 3 decimals** | Cheap follow-up | Helps leftover pose JSON; irrelevant while pose is cut. |
| **G. Compact `moveOrder` path encoding** | Low priority | 8 waypoints ~348 B; delta tiles ~177 B. Dropping `startX/Z` is invalid (`path[0]` is the next tile, start is often mid-tile). Do after full-state is gone. Notes: [research/06-compact-move-order.md](research/06-compact-move-order.md). |
| **H. 1 Hz pose heartbeat for walkers** | Optional, after D | Adds ~1 MiB/min at N=30 if 20% are walking. Useful only if heartbeat pose is **analytic** and the client **rejects rewind**. A stale heartbeat recreates today's bug. |
| **I. Player spatial interest** | Not first | Terrain already chunked; avatars are still room-wide on purpose (you need to see people approach). Guessing "40% visible" is not a design. High correctness cost. |
| **J. permessage-deflate** | Ops experiment, not the fix | Same-message zlib on a 30-player `state` compressed to ~6% in a one-shot `deflateSync` (repeated keys). Unique `moveOrder` ~50%. `ws` defaults this **off** (CPU + memory). Enable only with metrics; context-takeover helps JSON, hurts the event loop if mis-tuned. |
| **K. Protobuf / binary** | Still deferred | FUTURE_PROTO was right: high cost, second-order after B/C/D. Rough guess 40–50% of JSON once messages are already small. |
| **L. Stream pose every frame again for laggy clients** | **Rejected** | Restores the 193 MiB/min N=30 walking case and fights Path Playback. Lag is delay on a reliable socket, not missing samples. |
| **M. Client re-pathfind from destination only** | Rejected | Pathfinder drift vs server. Full path on `moveOrder` is the cheaper correctness choice. |

### Recommended stack (B + C + D + client hold)

Social hub, same 10 full-state-like presence events/min and 2 walks/player/min:

| | N=10 server | N=20 | N=30 | N=30 per client |
|---|---:|---:|---:|---:|
| **Today** | 0.51 MiB/min | 2.0 | **4.5** | 154 KiB/min |
| **B only** (one loaded player delta) | 0.12 | 0.38 | **0.78** | 27 KiB/min |
| **B+C** (slim presence) | 0.09 | 0.32 | **0.68** | 23 KiB/min |
| **B+C + 1 Hz heartbeat** | 0.21 | 0.79 | 1.7 | 59 KiB/min |

**New baseline estimate (fix in place, no heartbeat):** about **6× less** server egress in a 30-player social hub, **~85% of remaining bytes are `moveOrder`**, and per-client ingress drops from ~154 KiB/min to ~23 KiB/min. Idle rooms stay at ~0. Walking-only rooms stay on the Path Playback line (~1.3 MiB/min at N=30 for 4 walks/player/min).

If you later add a **1 Hz analytic heartbeat**, budget roughly **+1 MiB/min** at N=30 (20% walking). That is still far below today's social full-`state` tax, and far below the legacy pose stream.

---

## Poor connections (no teleport)

WebSocket is TCP: messages are **delayed or the socket dies**, they are not silently dropped. "Bad wifi" means **head-of-line delay and clock skew**, not missing every other pose sample. Sending pose every frame does not help a stalled socket; it fills the buffer and makes catch-up worse.

**Why remotes snap back today**

1. Path Playback uses **wall `Date.now()` vs `startAtMs`**. A client whose clock is ahead (or whose frames keep running while the server tick lags) **drains the order** and deletes it.
2. Occupied rooms then send **full `state`** with `conn.player` still at the **path origin** (tick has not copied analytic pose yet; `maybeBroadcastMoveOrder` also stamps `startX/startZ` from that stale pose).
3. `syncState` applies snapshot pose whenever `!remoteMoveOrders.has(address)`. Drain + stale roster = teleport back.

**Contract (agent-locked)**

1. **Presence events must not send a roster pose dump.** One-player `stateDelta`, and omit `x/y/z/vx/vz` while a grid path is in flight (same eligibility as `CUT_MOVEMENT_STREAM`).
2. **Snapshots never rewind Path Playback.** After drain, ignore pose that is behind the last playback pose along that path, until analytic/server pose has caught up **or** an intentional snap arrives.
3. **Intentional snaps stay snaps:** room change / `welcome`, `moveAbort`, Freeze, teleporter, join, jump `> 6` tiles, World Cup free-move.
4. **Playback clock is server-domain.** Stamp `serverNowMs` on `moveOrder`. Elapsed = `max(0, serverNowMs - startAtMs)` at send, then advance with local time from **receipt**. Do not compare `Date.now()` to a server epoch. Remotes may start up to one RTT late; they must not finish early.
5. **Stamp paths from analytic pose** (`playerPoseNow` / `pathMove.startPose`), never lagged `conn.player`, so a second click or a late `moveOrder` does not restart at the origin.
6. **Do not compensate lag with more pose.** If a safety net is needed, a **low-rate analytic pose** (≤ 1 Hz) that is subject to rule 2. Missed `moveAbort` is the dangerous case (walk through a closed gate): keep abort on the reliable socket; next presence/heartbeat may carry the abort pose.
7. **Self:** keep local prediction; reconcile with the echoed `moveOrder`. Camera snap rules in `shouldSnapCameraOnSelfSync` stay for join/jump.

Tab-hide already jumps **forward** on resume (elapsed wall time); that is acceptable. Poor-connection players should look **slightly late**, never **rewound**. Detail (including `walkId` vs reverse-click, missed abort, late-joiner welcome orders): [research/03-poor-connection-contract.md](research/03-poor-connection-contract.md).

---

## Server load (CPU), besides bytes

Cut-stream removes tick **bytes**, not tick **CPU**. Detail: [research/05-server-cpu.md](research/05-server-cpu.md).

- Tick is 20 Hz over every connection (analytic pose copy; `changed = true` while walking). Path math is cheap (~0.01–0.08 ms at N=30).
- Dirty rooms still `snapshotPlayers()` up to ~8.33 Hz **even when the send is suppressed**: cosmetics + player level hit SQLite. Estimate ~4 ms per snapshot, twice per broadcast opportunity (~8 ms at N=30). That is the bottleneck, not `JSON.stringify` (~37 µs once for a 30-player `state`; ~1.1 ms if encoded per recipient).
- Presence today: snapshot roster + per-recipient stringify of the full blob (~9 ms/event at N=30). One-player `stateDelta` drops that event to ~0.2 ms (`O(P)+O(N×P)` → `O(1)+O(N)`).

Optional follow-up: skip the second snapshot when the send is suppressed; stringify once when the filtered payload is identical for non-admin viewers.

World Cup pitch is a separate, heavier line (`ballState`, goalie, free-move pose) and is out of the click-to-walk savings.

---

## Recommended ship order

1. **Presence `stateDelta`** for `chatTyping`, chat-clear-typing, `nimSendIntent`, `setChallenge`, challenge timeout, country on field, profile rename (mirror achievement level-up). Kill `broadcastRoomStateFull` for those.
2. **Omit pose** on those deltas (and on any leftover full `state`) for active grid walkers. Stamp `moveOrder` from analytic pose.
3. **Client hold-last-playback** + server-domain clock (makes the uncommitted rewind tests go green). This is the no-teleport slice; it is not optional if we care about occupied rooms.
4. Strip `recentAliases` and null cosmetics from tick/presence snapshots (keep them on `welcome` / `playerJoined`).
5. Optional: 1 Hz analytic heartbeat; stringify-once; `WS_METRICS_INTERVAL_MS` on production to replace this estimate with a capture.
6. Not now: protobuf, compact keys, player spatial interest, re-enabling pose streaming.

---

## How to replace the estimate with a capture

Set `WS_METRICS_INTERVAL_MS=10000` on a staging room with 10/20/30 bots or volunteers. The existing `recordGameWsOutbound` already attributes **wire bytes × recipients** by `type`. Compare `state` vs `stateDelta` vs `moveOrder` before and after slice 1.

---

## Pointers

- Tick / full state: `server/src/rooms.ts` (`broadcastTickStateIfAllowed`, `broadcastRoomStateFull`, `broadcast`)
- Cut stream: `server/src/cutMovementStream.ts`
- Path order: `server/src/moveOrderBroadcast.ts`, `server/src/playerPathPose.ts`
- Client apply: `client/src/game/Game.ts` (`applyMoveOrder`, `syncState`, `refreshRemoteMoveOrderTarget`)
- Prior PRD (now partly shipped): `docs/brainstorm/movement-move-order-broadcast.md`
- JSON/protobuf parking: `docs/brainstorm/FUTURE_PROTO.md`
- Worker notes: [research/01-wire-baseline.md](research/01-wire-baseline.md), [02-full-state-triggers.md](research/02-full-state-triggers.md), [03-poor-connection-contract.md](research/03-poor-connection-contract.md), [04-method-comparison.md](research/04-method-comparison.md), [05-server-cpu.md](research/05-server-cpu.md), [06-compact-move-order.md](research/06-compact-move-order.md)
