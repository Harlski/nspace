# Catalog: room-wide player snapshots vs path orders

**Date:** 2026-08-18  
**Scope:** Current server behavior (no production changes). Click-to-walk social rooms are the occupied-room target; World Cup field-like free-move is noted where it diverges.  
**Primary sources:** `server/src/rooms.ts`, `server/src/cutMovementStream.ts`, `server/src/moveOrderBroadcast.ts`, `server/src/moveAbortBroadcast.ts`. Client send sites cited only where they set how often a server path can fire.

## Verdict

Path Playback already stops **tick** pose streaming for active grid walkers (`CUT_MOVEMENT_STREAM` = `MOVE_ORDER_BROADCAST`, default on). Occupied-room bandwidth is **not** dominated by those ticks. It is dominated by **event-driven full-roster `state`** (`broadcastRoomStateFull`): typing, tab-away / NIM-send, challenge flags, and a few worldcup / teleport / profile paths. Each of those messages is a complete `PlayerState[]` (pose, cosmetics, aliases, flags) fan-out to every socket in the room. A one-player `stateDelta` would suffice for every social-presence call site. Tick `state` / `stateDelta` and `moveOrder` / `moveAbort` are **room-wide**; they are not spatially filtered.

---

## 1. Wire taxonomy

| Message | Who is in the payload | Who receives it | Typical cadence |
|---|---|---|---|
| `state` | Full roster (`snapshotPlayers`) | Every ready WS in the room | Event `broadcastRoomStateFull`; or a tick when `sendFull` |
| `stateDelta` | Subset of `PlayerState` (changed players, each **full** player object) | Same room-wide fan-out | Ticks (~8 Hz cap); also freeze / invis / level |
| `moveOrder` | One address + path waypoints + start pose/time/speed | Same | Per validated walk (click-to-walk 120 ms rate) |
| `moveAbort` | One address + pose | Same | Path halt / pose correction |
| `welcome` | `self` + `others` (full `PlayerState` each) plus terrain / doors / … | **Unicast** to the joiner | Connect and room change |
| `playerJoined` | One `PlayerState` | Room except the joiner | Connect and room change |

`broadcast` (`rooms.ts`) JSON-stringifies once per viewer after `filterPresenceOutMsgForViewer`, then `ws.send`s to every ready connection in that room (`except` optional). Admin Invisibility can drop a subject from a viewer’s copy; it does **not** spatially subset players.

`snapshotPlayers` maps every non-`streamObserver` connection through `playerToOutState`, then appends NPC fakes. `playerToOutState` always:

- spreads `conn.player` (includes `address`, `displayName`, `x/y/z/vx/vz`, `recentAliases` up to 3 from profile store)
- sets `nimSendAway` from `conn.nimSendIntent`
- writes `cosmeticAura` / `cosmeticNameplate` / `cosmeticChatBubble` / `cosmeticTrail` from loadout (**`null` if unequipped**, so they serialize)
- sets `playerLevel` for achievement-eligible wallets
- sets `chatTyping` / `challengeOpen` / `adminInvisible` / `frozen` / `worldcupCountry` when active

So a “full `state`” is not a pose-only snapshot. It is the public player record for **everyone**.

---

## 2. Tick: full `state` vs `stateDelta` vs nothing

Simulation: `TICK_MS = 50` (20 Hz). Tick **wire** is capped by `STATE_BROADCAST_MIN_MS` (default **120** ms, ~8.3 Hz). Override `STATE_BROADCAST_MIN_MS`. Kill-switch `STATE_BROADCAST_DELTA=0` forces full `state` on every allowed tick (`USE_STATE_TICK_DELTA`).

`broadcastTickStateIfAllowed(roomId, room, now, dirty)`:

1. Empty room: drop pending + baselines; return.
2. If not `dirty` and room not in `pendingTickStateBroadcast`: **send nothing**.
3. If `now - last < STATE_BROADCAST_MIN_MS`: if `dirty`, remember pending; **send nothing** this tick.
4. Else snapshot `full = snapshotPlayers(roomId)` and decide `sendFull`.

### `sendFull` conditions (tick path only)

From `rooms.ts` `broadcastTickStateIfAllowed`:

| Condition | Meaning |
|---|---|
| `!USE_STATE_TICK_DELTA` | Env `STATE_BROADCAST_DELTA=0` |
| `!prev` | No `lastTickBroadcastPlayers` for this room (first send after empty / process start) |
| `prev.length !== full.length` | Roster size changed vs baseline |
| Some `full` address not in `prev` | New address without a matching baseline slot |
| After diffing: `changed.length === full.length` | Every player would be in the delta anyway |

Join/leave **try** to keep the baseline aligned: `broadcast` of `playerJoined` calls `mergeTickBaselinePlayer`; `playerLeft` calls `pruneTickBaselinePlayer`. `broadcastRoomStateFull` always `replaceTickBroadcastBaseline`. First tick in a freshly occupied room still often `sendFull` because `mergeTickBaselinePlayer` no-ops when there is **no** baseline map yet (`if (!cur) return`).

### `stateDelta` vs nothing (when not `sendFull`)

For each player in `full` vs `prev`:

- `tickPlayerStatesEqual` (pose eps 1e-5 / vel 1e-8, plus name, pay/away/typing/challenge/country/cosmetics/invis/frozen/level): skip.
- Else `shouldIncludeInTickStateDelta` (`cutMovementStream.ts`):
  - **omit** if movement-only change **and** CUT-eligible (see §3); `suppressedMovementOnly = true`
  - **include** (clone full `PlayerState`) otherwise

Then:

- `changed.length === 0`: **send nothing**. If any walker was movement-suppressed, still `replaceTickBroadcastBaseline` so the next diff does not replay those poses. Always stamps `lastTickStateBroadcastAt`.
- else if `changed.length === full.length`: upgrade to full `state`
- else `broadcast({ type: "stateDelta", players: changed })`

Each `stateDelta` entry is still a **full** `PlayerState` (same fields as `state`), not a field-level patch. Client `mergeStateDeltaPlayer` replaces the player object and clears omitted ephemeral flags.

`dirty` is true when any human path step/analytic pose changed this tick, or an NPC bot moved. `pendingTickStateBroadcast` is also set by freeze-on, `moveTo` stop, `no_path` snaps, and some `openGate` outcomes; those wait for the next allowed tick rather than calling `broadcastRoomStateFull`.

### Default click-to-walk room with CUT on

Walkers still **simulate** pose every tick (`ANALYTIC_PATH_SKIP_STEPPING` is implied by `MOVE_ORDER_BROADCAST`; `tickAnalyticPathHuman` writes `conn.player` x/y/z/vx/vz). That sets `dirty`. The tick then **suppresses** those walkers from `stateDelta`. If the only diffs are CUT-suppressed movement (plus idle peers), the tick sends **nothing**.

NPC fakes are **not** CUT-eligible (no `ClientConn.pathQueue`; `pathQueueLength` is 0). Default `FAKE_PLAYER_COUNT=2`. While they wander (`FAKE_PATH_MAX_STEPS=5`, idle 10 s between paths), they keep appearing in `stateDelta` at the 120 ms cap. They never emit `moveOrder`.

---

## 3. `CUT_MOVEMENT_STREAM` eligibility

`CUT_MOVEMENT_STREAM` is `MOVE_ORDER_BROADCAST` (`cutMovementStream.ts`). `MOVE_ORDER_BROADCAST` is on unless `MOVE_ORDER_BROADCAST=0` (`moveOrderBroadcast.ts`).

`cutMovementStreamEligible({ enabled, pathQueueLength, isFieldFreeMove })` is true iff:

- flag on, **and**
- `pathQueueLength > 0`, **and**
- **not** `worldcupIsFieldLikeRoom` (pitch / match free-move)

`shouldIncludeInTickStateDelta`:

- no movement and no “presence” change → omit
- eligible **and** movement changed **and** presence equal → omit (`suppressedMovementOnly`)
- otherwise include

“Presence” here (`tickPlayerPresenceEqual`) is: `displayName`, `nimiqPay`, `nimSendAway`, `chatTyping`, `challengeOpen`, `worldcupCountry`, four cosmetic slots. It does **not** include `adminInvisible` / `frozen` / `playerLevel` (those have dedicated non-tick `stateDelta` paths).

World Cup field-like rooms: walkers stay on velocity snapshots even with the flag on. `moveOrder` is still dual-sent on `moveTo` there.

Issue `docs/brainstorm/movement-move-order-broadcast/issues/05-cut-movement-stream.md` said typing / cosmetics / flags would ride **tick `stateDelta`**. That is true **if** the change is only discovered on a tick. Live social intents do **not** wait: they call `broadcastRoomStateFull` immediately (§5).

---

## 4. Every `broadcastRoomStateFull` call site

Helper (`rooms.ts`):

```ts
broadcast(roomId, { type: "state", players: snapshotPlayers(roomId) });
replaceTickBroadcastBaseline(roomId);
```

Room-wide. Includes live x/y/z/vx/vz for **path walkers** (analytic pose already copied onto `conn.player`). That is the occupied-room rewind analogue: a typing `state` can snap Path Playback to a lagged or mid-path server pose.

| # | Approx. site | User / server event | Busy social-room frequency | One-player `stateDelta` enough? |
|---|---|---|---|---|
| 1 | `teleportPlayer` same-room branch | Warp / door / spawn inside the **same** room; halt path + optional `moveAbort` | Uncommon (teleports, same-room snap) | **Yes** for the warping player (plus existing `moveAbort`). Others unchanged. |
| 2 | `worldcupKickoffReset` | Post-goal snap of **match participants** on the pitch | Match-only; per goal | **Almost:** `stateDelta` of the two (or few) snapped players. Full roster is spectators + keepers-as-players. |
| 3 | `worldcupBeginMatch` when `countdownMs <= 0` | Challenge accepted, skip handshake | Rare | **Yes** (two players drop `challengeOpen`). |
| 4 | `worldcupBeginMatch` after pending record | Challenge accepted; clear challenge bubbles in **origin** room | Per 1v1 start, not hub-idle | **Yes** (two players). Handshake bubbles are separate `chat` messages. |
| 5 | `worldcupStartMatch` | After teleport to pitch; “countdown room should re-render” | Per 1v1 start | **Yes** for remaining origin-room peers’ challenge flags (participants already left via `playerLeft`). |
| 6 | `worldcupSweepStaleChallenges` | Tick sweep; `challengeTimeoutMs` default **60 s** | At most once per expired challenge (flags cleared so not every 50 ms) | **Yes** (the expired player(s)). |
| 7 | `nimSendIntent` handler | Client `nimSendIntent` (tab hidden **or** NIM-send overlay). **No equality guard** — every inbound message dumps full `state` even if `active` is unchanged | High in occupied rooms: visibilitychange, welcome sync, wallet deep-link open/close. Mobile tab switches scale with N people | **Yes** (that player’s `nimSendAway`). Should also no-op when unchanged (typing already does). |
| 8 | `chatTyping` handler | Client `chatTyping`. Equality guard: duplicate `active` ignored | **Highest social rate.** Composer: first non-empty input → `true`; idle **2.5 s**, blur, Enter, or empty input → `false`. No server rate limit | **Yes** (that player’s `chatTyping`). Tick CUT already knows how to include this field in a delta. |
| 9 | `setChallenge` handler | Raise / cancel 1v1 donut | Low–medium in hub if people 1v1; two edges per challenge | **Yes** (`challengeOpen`). |
| 10 | `setCountry` | Country pick; **only if** `WORLDCUP_ENABLED` **and** current room is field-like | Field / pitch, not typical click-to-walk hub | **Yes** (`worldcupCountry`). |
| 11 | `chat` handler after send | If `conn.chatTyping` still true when chat is applied, full `state` to clear the cue | Current client calls `notifyChatNotTyping()` **before** `sendChat`, so this is usually a **backup**. If typing-false races after chat, this still fires | **Yes**. |
| 12 | `syncPlayerProfileDisplayNameForWallet` | HTTP profile / username change | Rare | **Yes** (`displayName` + `recentAliases`). |

**Not** using `broadcastRoomStateFull`: connect, room-change teleport (uses `welcome` + `playerJoined` / `playerLeft`), path walking (uses `moveOrder` + CUT), freeze (one-player `stateDelta` + `moveAbort`), admin invis (per-recipient `stateDelta` / silent join-leave), achievement level (one-player `stateDelta`).

---

## 5. Social presence: typing / NIM-send / challenge / chat

### `chatTyping`

- Server: `rooms.ts` handler sets `conn.chatTyping` and **always** `broadcastRoomStateFull` on change.
- Client (`main.ts`): send `true` once per compose session; `false` on 2.5 s idle, blur, Enter, empty field, cleanup.
- Enter path: `notifyChatNotTyping()` then `sendChat` / whisper. Typical public send = **one** full `state` (typing off) **plus** the `chat` line — not two full states — because typing is cleared first. Whisper-only Enter still pays the **room-wide full `state`** to clear typing.
- Tick CUT would have included `{ chatTyping }` on **one** `stateDelta` player **if** the server waited for the tick. It does not wait.

### `nimSendIntent`

- Server: `conn.nimSendIntent = Boolean(msg.active)` then **unconditional** `broadcastRoomStateFull` (no `===` short-circuit).
- Client `syncAwayPresenceToServer`: `active = document.hidden \|\| walletSendNimFlowOpen`. Fired on visibilitychange, HUD NIM deep-link open/close, and after `welcome`.
- Occupied rooms: many clients backgrounding the tab each dump the **entire roster** including walkers’ live poses.

### `setChallenge`

- Server: set/clear `conn.challengeOpen` then `broadcastRoomStateFull`.
- Same pattern as typing: one boolean on one player, full roster on the wire.

### Chat send after typing

- `chat` itself is a small room-wide message (not a player snapshot).
- Extra full `state` only if `hadTyping` is still true in the chat handler (backup).
- NPC chat is `bubbleOnly` and does **not** call `broadcastRoomStateFull`.

**Answer to the explicit question:** yes — `chatTyping`, `nimSendIntent`, `setChallenge`, and chat-clears-typing currently send a **FULL roster** including `x,y,z,vx,vz`, cosmetics (`null` or sku), `recentAliases`, name, level, and flags.

---

## 6. Path orders: `moveOrder` / `moveAbort`

`maybeBroadcastMoveOrder`: if `shouldEmitMoveOrder({ enabled: MOVE_ORDER_BROADCAST, pathQueueLength })`, `broadcast(buildMoveOrderOutMsg(…))` with `path` copy, `startX/startZ` from `conn.player`, `startAtMs`, `speed` default 5.

Call sites (all room-wide):

| Site | When |
|---|---|
| Field `moveTo` | Straight-line one-waypoint queue (joystick / pitch) |
| Grid `moveTo` after pathfind / recovery path | Click-to-walk |
| `openGate` auto-walk | When the computed path has length ≥ 2 |

`maybeBroadcastMoveAbort`: if `shouldEmitMoveAbort` (`enabled` and (`hadPathQueue` **or** `poseCorrection === true`)).

| Site | When |
|---|---|
| `clearConnPathQueue` | `moveTo` `{ stop: true }`; freeze-on; some gate blocks |
| Same-room `teleportPlayer` | `poseCorrection: true` |
| Leaving room in `teleportPlayer` | `poseCorrection: true` (old room) |
| `worldcupKickoffReset` | Per snapped participant, `poseCorrection: true` |
| `moveTo` `no_path` / failed start node | Snap + abort + `pendingTickStateBroadcast` |

`moveOrder` size scales with waypoint count (hub A* can be long). Cadence is click rate (120 ms floor in click-to-walk; 50 ms on field). Occupied rooms: **more movers × more recipients**, but **one message per walk**, not ~8 pose samples/sec/walker.

Movement Watch (`movementWatchClick` / snapshot / clear) is an **admin side channel**, not the public room stream (`docs/THE-LARGER-SYSTEM.md`).

---

## 7. Welcome / `playerJoined` (join cost, not per-tick)

### `welcome` (unicast)

Two builders, same shape:

- First connect (`handleConnection` path): `others = snapshotPlayers` minus self, visibility-filtered; `self = playerToOutState(conn)`.
- `teleportPlayer` into a **different** room: `others` from that room’s connections minus self.

Each other player is a full `PlayerState` (pose + cosmetics + aliases + flags). Plus terrain lists (chunked only in spatial rooms ≥10k tiles), doors, chat backlog, etc. Cost is **O(roster)** to **one** client, once per join / room change.

`welcome` does **not** embed in-flight `moveOrder`s (open question on the movement-bandwidth map). Late joiners see current `others[].x/z` only.

### `playerJoined` (room-wide except joiner)

- After connect (non-`streamObserver`)
- After `teleportPlayer` into a new room
- NPC spawn in `ensureFakePlayers` (on first connect to a room that allows fakes)

Payload: one `playerToOutState` / fake `PlayerState`. `broadcast` merges that player into the tick baseline when a baseline already exists.

Room change also `playerLeft` in the **old** room (address only). Disconnect: `playerLeft`, no full `state`.

---

## 8. Spatial interest: player `state` is room-wide

`spatialFilteredOutMsgType` is **only**:

- `obstaclesDelta`
- `baseFloorColorDelta`
- `extraFloorDelta`
- `removedBaseFloorDelta`
- `noWalkFloorDelta`

Confirmed: **`state`, `stateDelta`, `moveOrder`, `moveAbort`, `welcome`, `playerJoined` are not in that set.** `broadcast` uses the spatial loop only when `spatialFilteredOutMsgType(msg.type) && roomUsesSpatialInterest(bounds)` (rooms with ≥10 000 tiles, e.g. Pixel). Player snapshots still go to **every** connection in the room.

`filterPresenceOutMsgForViewer` still runs: invisible admins omitted for non-admins; `moveOrder`/`moveAbort` dropped for viewers who must not see that subject.

`docs/features-checklist.md` and the movement-bandwidth map already record this: terrain interest exists; **player `state` is still room-wide**.

---

## 9. Contrast: one-player `stateDelta` already exists

These paths already fan out a **single** `PlayerState` without a full roster:

| Path | Payload |
|---|---|
| Achievement level change | `{ type: "stateDelta", players: [playerToOutState(conn)] }` via `broadcast` |
| `broadcastFrozenStateDelta` | Per-recipient `stateDelta` of one player (strip `frozen` for non-admins) |
| Admin Invisibility toggle | Per-recipient `stateDelta` **or** silent `playerJoined` / `playerLeft` |

Freeze-on also `clearConnPathQueue` (`moveAbort`) + `pendingTickStateBroadcast`. That is the pattern social flags should use, not `broadcastRoomStateFull`.

Cosmetic loadout HTTP (`PUT /api/cosmetics/loadout`) does **not** broadcast at all. Peers only see new cosmetics on the next snapshot that happens to include that player (tick if `dirty`, or a full `state` event). Idle rooms can lag cosmetics until someone walks or types.

---

## 10. Ranked occupied-room bandwidth culprits

Ranked for a **busy click-to-walk social room** (hub-like, Path Playback on, default NPC count), **server egress ≈ payload × occupants**. Empty room: almost none of (1)–(2).

1. **Event full `state` from `chatTyping` / `nimSendIntent` / chat-clears-typing** — O(N²) JSON, human-interaction and tab-visibility rate, **full roster including live walker poses, cosmetics, aliases**. Largest occupied-vs-empty gap. Typing has an equality guard; NIM-send does not.
2. **Event full `state` from `setChallenge` and stale-challenge sweep** — same O(N²) shape, lower rate than typing unless the hub is a 1v1 lobby.
3. **NPC tick `stateDelta` (default 2 fakes)** — not CUT-eligible; ~8 Hz while walking; O(N) egress. Always-on tax independent of “social” but present in occupied default deploys.
4. **`moveOrder` fan-out** — O(N) per click × path bytes. Correct Path Playback traffic; scales with walkers × audience, not with typing. Far cheaper than pre-CUT pose streaming.
5. **Tick full `state` fallbacks** — first occupancy, `STATE_BROADCAST_DELTA=0`, or `changed.length === full.length` (e.g. CUT **off** and everyone moving). Rare with CUT on and a healthy baseline; catastrophic if the kill-switch is off in a full room.
6. **Worldcup origin/kickoff/country full `state`** — bursty; pitch/1v1, not the default hub loop.
7. **Same-room teleport and profile-name full `state`** — infrequent; still oversized vs a one-player delta.
8. **`welcome` + `playerJoined`** — join/leave cost. Welcome is large but **unicast**; `playerJoined` is one player × (N−1). Not a per-tick tax.
9. **`moveAbort`** — small, per interrupt; necessary for Path Playback.
10. **Dedicated one-player `stateDelta` (freeze / invis / level)** — rare and already slim.
11. **`chat` text** — small vs any roster snapshot.

**Implication for later slices (not implemented here):** replacing `broadcastRoomStateFull` on sites 7–11 in §4 with one-player `stateDelta` + baseline merge (as freeze already does) is the occupied-room win. CUT already did the walk-tick win. Slimming `PlayerState` on remaining snapshots (drop aliases/cosmetics from pose ticks; omit nulls) is a second-order cut.

---

## Sources

- `server/src/rooms.ts` — `USE_STATE_TICK_DELTA`, `STATE_BROADCAST_MIN_MS`, `broadcastRoomStateFull`, `broadcastTickStateIfAllowed`, `tickPlayerStatesEqual`, `broadcast`, `spatialFilteredOutMsgType`, `snapshotPlayers`, `playerToOutState`, `maybeBroadcastMoveOrder`, `maybeBroadcastMoveAbort`, `teleportPlayer`, worldcup kickoff/begin/start/sweep, WS handlers `nimSendIntent` / `chatTyping` / `setChallenge` / `setCountry` / `chat` / `moveTo` / `openGate`, tick loop, `syncPlayerProfileDisplayNameForWallet`, welcome / `playerJoined`
- `server/src/cutMovementStream.ts` — `CUT_MOVEMENT_STREAM`, `cutMovementStreamEligible`, `shouldIncludeInTickStateDelta`
- `server/src/moveOrderBroadcast.ts` — default-on flag, `buildMoveOrderOutMsg`, `shouldEmitMoveOrder`
- `server/src/moveAbortBroadcast.ts` — `shouldEmitMoveAbort`, `poseCorrection`
- `server/src/playerPathPose.ts` — `ANALYTIC_PATH_SKIP_STEPPING`, `tickAnalyticPathHuman`
- `server/src/interestChunks.ts` — `roomUsesSpatialInterest` (≥10 000 tiles)
- `server/src/playerProfileStore.ts` — `getRecentAliases` cap 3
- `server/src/adminPresence.ts` — invis toggle uses `stateDelta` / join-leave, not full `state`
- `server/test/cutMovementStream.test.ts` — eligibility and movement-only omit
- `client/src/main.ts` — `onChatComposing` / 2.5 s idle, Enter `notifyChatNotTyping`, `syncAwayPresenceToServer`; inbound `state` replaces roster, `stateDelta` merges
- `client/src/net/ws.ts` — `sendChatTyping`, `sendNimSendIntent`, `setChallenge`
- `client/src/net/mergeStateDeltaPlayer.ts` — full-player merge, ephemeral flags from delta only
- `docs/process.md` — env defaults for tick delta, Path Playback, fake players
- `docs/THE-LARGER-SYSTEM.md` — room stream vs Movement Watch; player sync is shared with every client in the room
- `docs/features-checklist.md` — spatial tile sync vs room-wide player `state`; Path Playback / CUT
