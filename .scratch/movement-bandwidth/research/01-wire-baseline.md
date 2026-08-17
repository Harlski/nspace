# Movement wire baseline (JSON UTF-8)

Measured from primary source (code + `JSON.stringify` of realistic payloads).
Throwaway: [`.scratch/movement-bandwidth/measure-wire-baseline.mjs`](../measure-wire-baseline.mjs)
(`Buffer.byteLength(JSON.stringify(...), "utf8")`). No production changes.

Sizes are **application JSON only**. WebSocket text frames add ~2-8 header bytes (unmasked server to client). TLS is extra. There is **no** `perMessageDeflate`.

---

## Verified constants and send path

| Fact | Source |
|------|--------|
| `TICK_MS = 50` | `server/src/rooms.ts` `TICK_MS` (line 591) |
| `STATE_BROADCAST_MIN_MS` default **120** (`Math.max(TICK_MS, floor(env ?? "120"))`) | `rooms.ts` lines 597-600 |
| Tick `state` / `stateDelta` cadence if dirty: `1000/120 ≈ 8.33 Hz` | `broadcastTickStateIfAllowed` lines 683-758, 8786 |
| `MOVE_ORDER_BROADCAST` on unless env is `"0"` | `server/src/moveOrderBroadcast.ts` `isMoveOrderBroadcastEnabled` (lines 10-16) |
| `CUT_MOVEMENT_STREAM = MOVE_ORDER_BROADCAST` | `server/src/cutMovementStream.ts` line 8 |
| Cut-stream: tick `stateDelta` omits pose for active **grid** path walkers when only movement changed | `shouldIncludeInTickStateDelta` (`cutMovementStream.ts` lines 78-101); used at `rooms.ts` 734-742 |
| World Cup field-like free-move **keeps** pose in `stateDelta` | `cutMovementStreamEligible` requires `!isFieldFreeMove` |
| Player snapshots are **not** spatially filtered; only terrain deltas are | `spatialFilteredOutMsgType` (`rooms.ts` 2098-2105): `obstaclesDelta`, `baseFloorColorDelta`, `extraFloorDelta`, `removedBaseFloorDelta`, `noWalkFloorDelta` |
| `broadcast()` JSON.stringifies **once per recipient** after presence filter; fan-out = payload × N | `rooms.ts` 4458-4513 (non-spatial path: 4493-4512) |
| No `perMessageDeflate` on `WebSocketServer` | `server/src/index.ts` line 3644: `new WebSocketServer({ server, path: "/ws" })`. `ws` defaults `perMessageDeflate` to false. |
| `moveTo` min interval (click-to-walk) | `RATE_MOVE_TO_MS = 120` (`rooms.ts` 830) |
| `stateDelta` / `state` player entries are **full `PlayerState` clones**, not pose-only | `clonePlayerState` = `{ ...p }` (`rooms.ts` 616-618); `changed.push(clonePlayerState(p))` (729, 742) |
| If every snapshot player changed, tick sends **full `state`**, not a delta | `if (changed.length === full.length) sendFull = true` (`rooms.ts` 750-754) |

Wire address is the JWT `sub`: Nimiq **user-friendly** address from `publicKey.toAddress().toUserFriendlyAddress()` (`server/src/verifyNimiq.ts` line 32), assigned at `addClient` (`rooms.ts` 8984). Format: 9 groups of 4 + 8 spaces = **44 chars** (compact IBAN-like body is 36). Default `displayName` is `walletDisplayName`: first 4 + last 4 of that string (`server/src/walletDisplayName.ts` lines 5-8) → **8 chars** (e.g. `NQ97M02Y`). Custom usernames are 1-12 `[a-zA-Z0-9]` (`server/src/usernamePolicy.ts`).

---

## What `playerToOutState` actually puts on the wire

`playerToOutState` (`rooms.ts` 5546-5561) is the snapshot used by `snapshotPlayers` (5563-5572), tick `state` / `stateDelta`, `welcome`, and `playerJoined`.

1. Spreads `conn.player` (plus `nimSendAway: true` only if `conn.nimSendIntent`).
2. **Always** writes four cosmetic keys via `applyCosmeticLoadoutToPlayer` (5528-5534): `string` or `null`. `JSON.stringify` **emits** `"cosmeticAura":null` etc.
3. **Always** sets `playerLevel` for NQ wallets (`refreshPlayerLevelOnPlayer`, 5536-5544; guests omit it). Level 1 is `floor(points/100)+1` (`server/src/playerLevel.ts` 16-18), so a new wallet still has `"playerLevel":1`.
4. Sets `chatTyping` / `challengeOpen` / `adminInvisible` / `frozen` **only when true**.
5. Sets `worldcupCountry` only when `WORLDCUP_ENABLED` (default on, `server/src/worldcup/config.ts` 35-36) **and** the player has a chosen country.

### `recentAliases` is on every human snapshot

Yes. `addClient` always assigns `recentAliases: getRecentAliases(compactSelf)` (`rooms.ts` 8981-8986). `getRecentAliases` returns up to **3** strings (`server/src/playerProfileStore.ts` 313-317). Empty list is still `[]` on the object, and `JSON.stringify` includes `"recentAliases":[]`.

`tickPlayerStatesEqual` (`rooms.ts` 628-648) does **not** compare `recentAliases`. Alias-only edits go out via `broadcastRoomStateFull` from `syncPlayerProfileDisplayNameForWallet` (14977-14988), not a tick delta.

NPC fakes (`snapshotPlayers` 5567-5571) are **lean** 7-field objects (no aliases/cosmetics/level). They are **not** `ClientConn`s, so cut-stream sees `pathQueueLength: 0` and **still streams NPC pose** while they wander. Default `FAKE_PLAYER_COUNT = 2` (`rooms.ts` 853-857) in rooms that allow fakes (`roomAllowsFakePlayers`, 1303-1316). Tables below are **N humans only**; add ~2 lean NPC `PlayerState`s to full `state` where fakes exist.

`streamObserver` clients receive broadcasts but are omitted from `snapshotPlayers` (5564-5566). Recipient count can exceed visible players.

---

## 1. PlayerState JSON sizes (one object)

Address = 44-char user-friendly; idle pose integers `{x:12,y:0,z:-8,vx:0,vz:0}`; cardinal walk from the same lerp as `stepHumanAlongPath` (`server/src/pathPosition.ts` 56-90) after 150 ms toward the next tile: `{x:12.75,y:0,z:-8,vx:5,vz:0}`. Diagonal sample uses one 50 ms step toward `(1,1)` (long IEEE digits).

| Variant | What it is | Idle B | Cardinal walk B | Diagonal walk B |
|---------|------------|--------|-----------------|-----------------|
| **Lean** | Only `address, displayName, x,y,z,vx,vz` (hypothetical; **not** `playerToOutState`) | **117** | 120 | 185 |
| **Actual idle wallet** | What `playerToOutState` emits: lean + `recentAliases:[]` + 4 cosmetic `null`s + `playerLevel` | **244** | **247** | 312 |
| **Loaded** | Actual + 3 aliases + 4 production preset ids + `nimiqPay:true` + `worldcupCountry:"DE"` + `playerLevel:12` + 12-char name | **395** | 398 | - |
| Loaded + `chatTyping:true` | Ephemeral flag present only when true | 413 | - | - |

Overhead vs lean idle (~127 B): `"recentAliases":[]` + four `"cosmetic*:null"` + `"playerLevel":3`.

Loaded cosmetics use real preset ids from `server/src/cosmeticPresets.ts` (`aura-ref-magic-ring`, `nameplate-frame-neon`, `bubble-rounded-pastel`, `trail-ref-spark-path`).

False flags (`nimiqPay:false`, `chatTyping:false`, …) are **not** on the wire.

---

## 2. Full `state` message (`{ type:"state", players:[...] }`)

Envelope `{"type":"state","players":[]}` is 26 B; N players plus commas.

| N | Lean players (hypothetical) | **Actual idle wallets** | Loaded idle wallets |
|---|-----------------------------|-------------------------|---------------------|
| 10 | 1208 | **2478** | 3988 |
| 20 | 2388 | **4928** | 7948 |
| 30 | 3568 | **7378** | 11908 |

Walking poses (cardinal) add ~3 B per player (~30/60/90 B on the full message).

---

## 3. `stateDelta` for 1 changed player (full `PlayerState`, not slim pose)

Envelope `{"type":"stateDelta","players":[ … ]}`.

| Payload | Bytes |
|---------|------:|
| Lean idle (hypothetical) | 151 |
| Actual idle wallet | 278 |
| **Actual cardinal walk** (typical tick pose) | **281** |
| Actual diagonal walk (IEEE floats) | 346 |
| Loaded cardinal walk | 432 |
| Loaded + typing | 447 |

Primary number for click-to-walk ticks: **281 B** per 1-player `stateDelta` (actual `playerToOutState` object).

If **all N** players differ from the tick baseline, the server sends **full `state`** (section 2), not an N-player delta (`rooms.ts` 750-754). An N-player `stateDelta` is only a few bytes larger than full `state` (measured 2513 vs 2508 at N=10) and is not the all-walking path.

---

## 4. `moveOrder` (path `{x,z,layer}`)

`buildMoveOrderOutMsg` (`server/src/moveOrderBroadcast.ts` 35-52): `type, address, path, startX, startZ, startAtMs, speed` (`speed` default `DEFAULT_PATH_MOVE_SPEED = 5`, `pathPosition.ts` 27). Grid `moveTo` sets `pathQueue = full.slice(1)` (`rooms.ts` 10848) so waypoint count is remaining tiles, not including the start node. Broadcast to the **whole room**, including the mover (`maybeBroadcastMoveOrder`, 5092-5115, no `except`).

Integer tile waypoints; idle integer `startX`/`startZ`; 13-digit `startAtMs`.

| Path length | Bytes | vs previous |
|-------------|------:|-------------|
| 2 waypoints | **196** | |
| 8 waypoints | **346** | +150 (~25 B/wp) |
| 20 waypoints | **646** | +300 |

Mid-walk float `startX`/`startZ` (cardinal 12.75): 8-wp **349 B** (+3). Field-like free-move uses one float waypoint (`rooms.ts` 10712); size sits near the 2-wp row plus longer floats.

---

## 5. `moveAbort`

`buildMoveAbortOutMsg` (`server/src/moveAbortBroadcast.ts` 20-36): `type, address, x, z, y, vx, vz`.

| Pose | Bytes |
|------|------:|
| Idle integers | **111** |
| Cardinal walk | 114 |
| Diagonal IEEE | 179 |

---

## 6. Fan-out: bytes × N (room-wide)

Per-client **ingress** = payload bytes. Server **egress** = payload × N (stringify+send per recipient; presence filter can drop invisible admins, so N is "eligible viewers").

### Per event

| Event | Payload B | Egress N=10 | N=20 | N=30 | Per-client |
|-------|----------:|------------:|-----:|-----:|-----------:|
| Full `state` (actual idle) | 2478 / 4928 / 7378 | **24780** | **98560** | **221340** | = payload |
| Full `state` (loaded idle) | 3988 / 7948 / 11908 | 39880 | 158960 | 357240 | = payload |
| `stateDelta` 1 actual walker | 281 | 2810 | 5620 | 8430 | 281 |
| `moveOrder` 8 wp | 346 | 3460 | 6920 | 10380 | 346 |
| `moveAbort` idle | 111 | 1110 | 2220 | 3330 | 111 |

Quadratic: `moveOrder` / 1-player `stateDelta` egress scales as **N × payload**; full `state` egress scales as **N × (c0 + c1 N) ≈ O(N²)**.

### Per second (tick)

Tick broadcasts run at **8.33 Hz only if dirty** (`broadcastTickStateIfAllowed`). Idle after baseline match: `changed === false` and no pending → **no send** (lines 695-696).

With cut-stream, **movement-only** grid walks increment `dirty` (analytic tick still writes pose, `playerPathPose.ts` `tickAnalyticPathHuman` 117-154) but `shouldIncludeInTickStateDelta` drops them. If every change is suppressed, **no WS send**; baseline is still refreshed (`rooms.ts` 744-748). Walking-only humans → **~0 tick pose bytes**.

Arrival (path queue empty, pose/vel now differs, cut-stream no longer eligible) **does** emit a 1-player `stateDelta` (~281 B). Chained clicks that keep `pathQueue.length > 0` skip that.

---

## 7. Scenarios (N ∈ {10, 20, 30})

Assume click-to-walk room, N humans = N recipients, no stream observers, no fakes unless noted. KiB = bytes/1024.

### A. All idle (baseline already matches)

**0 B/s** tick `state` / `stateDelta`. `dirty` stays false (`advanceAlongPathHuman` with empty queue does not set `changedThis`, `pathPosition.ts` 57-60).

Caveat: default **2 wandering NPCs** (where allowed) are not cut-stream eligible. While they walk, expect ~8.33 Hz `stateDelta` of **1-2 lean NPC objects**, not zero.

### B. All walking under Path Playback (default)

`moveOrder` once per accepted `moveTo`. No pose in tick `stateDelta` while `pathQueue.length > 0` and only movement changed.

Let **w** = walks per player per second. Then:

- orders/s = **N w**
- server egress B/s = **N² w × 346** (8-wp)
- client ingress B/s = **N w × 346**

| Assumption | w per player | N=10 server | N=20 server | N=30 server | N=10 client |
|------------|-------------:|------------:|------------:|------------:|------------:|
| 4 walks/min (social) | 0.0667 | 2.3 KiB/s | 9.2 KiB/s | 20.7 KiB/s | 0.23 KiB/s |
| Continuous 8-tile paths (speed 5 → 1.6 s/walk) | 0.625 | **21.1 KiB/s** | **84.5 KiB/s** | **190 KiB/s** | 2.1 KiB/s |
| Click-spam cap (`RATE_MOVE_TO_MS` 120) | 8.33 | 282 KiB/s | 1.10 MiB/s | 2.47 MiB/s | 28.2 KiB/s |

If each walk **completes** (queue drains), add ~**N² w × 281** B/s for arrival `stateDelta`s (staggered). Completing 8-tile walks at w=0.625, N=10: extra ~17 KiB/s server.

`moveAbort` is extra only when a path is cut (`maybeBroadcastMoveAbort`, `rooms.ts` 5118-5136).

### C. Legacy `MOVE_ORDER_BROADCAST=0`: all walking, pose every ~120 ms

Cut-stream off → every walker's pose fails `tickPlayerStatesEqual`. If **all N** moved: `changed.length === full.length` → **full `state` at 8.33 Hz** (not N slim poses).

Using **actual** `playerToOutState` walking snapshots:

| N | Payload B @ 8.33 Hz | Server B/s | Server | Per-client B/s |
|--:|--------------------:|-----------:|--------|---------------:|
| 10 | 2508 | 209000 | **204 KiB/s** | 20.4 KiB/s |
| 20 | 4988 | 831333 | **812 KiB/s** | 40.6 KiB/s |
| 30 | 7468 | 1867000 | **1.78 MiB/s** | 60.8 KiB/s |

Loaded cosmetics/aliases (~all players dressed): N=30 → **2.86 MiB/s** server (11998 × 8.33 × 30).

One walker only (delta, not sendFull): **281 B × 8.33 Hz × N** egress → 22.9 / 45.7 / 68.6 KiB/s server for N=10/20/30; **2.3 KiB/s** per client regardless of N.

### D. Occupied social: extra full `state` from `chatTyping` etc.

`chatTyping` sets `conn.chatTyping` and calls **`broadcastRoomStateFull`** (`rooms.ts` 9566-9570): a **full room `state`**, not a 1-player delta. Same for `nimSendIntent` (9560-9563). Rate is an input; cost is per event.

| N | Per full-`state` event (actual idle) | Server egress | Per client |
|--:|-------------------------------------:|--------------:|-----------:|
| 10 | 2478 B | **24.2 KiB** | 2.42 KiB |
| 20 | 4928 B | **96.3 KiB** | 4.81 KiB |
| 30 | 7378 B | **216 KiB** | 7.21 KiB |

If **R** such events per second (each typing on **and** off is two events): server B/s = **R × N × |state|**. Example: 8 typing toggles/min (R=8/60) at N=20 → ~12.8 KiB/s server on top of movement.

Other `broadcastRoomStateFull` call sites exist (profile rename, challenges, worldcup hooks, …). Same per-event cost as the table.

---

## Comparison snapshot (server egress)

Humans only, actual (not lean) snapshots, 8-wp `moveOrder`, cardinal walk.

| Scenario | N=10 | N=20 | N=30 |
|----------|------|------|------|
| A idle tick | 0 | 0 | 0 |
| B continuous 8-tile Path Playback | 21 KiB/s | 84 KiB/s | 190 KiB/s |
| C legacy all-walking full `state` @ 8.33 Hz | 204 KiB/s | 812 KiB/s | **1.78 MiB/s** |
| D one `chatTyping` full `state` (not a rate) | 24 KiB | 96 KiB | 216 KiB |

Path Playback at social walk rates is ~10-100× cheaper than the legacy pose stream. Click-spam `moveOrder` at 8.33 Hz can **exceed** legacy C at large N because each order is still room-wide JSON. Occupied hubs are often dominated by **full `state` events** (D), not by Path Playback pose.

---

## Method notes

- Numbers from Node `JSON.stringify` of objects matching `PlayerState` / `MoveOrderOutMsg` / `MoveAbortOutMsg`. Key order follows object literals (size-invariant).
- Coordinate digit length matters: idle integers are the floor; cardinal `12.75`/`5` is typical grid walking; diagonal IEEE strings add ~65 B per player.
- Metrics already count UTF-8 JSON × recipients (`recordGameWsOutbound`, `rooms.ts` 4503-4509, `server/src/gameWsMetrics.ts`).
