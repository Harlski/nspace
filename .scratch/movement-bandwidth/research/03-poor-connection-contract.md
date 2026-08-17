# Poor-connection Path Playback contract

Status: **agent-locked** (grill recommendations accepted). Analysis only; no production code in this ticket.

Goal: keep self and remote avatars visually in sync in click-to-walk rooms **without** tick pose streaming every frame (including laggy clients), and **without** visual teleport-back along an in-flight walk.

Glossary: [CONTEXT.md](../../../CONTEXT.md) **Path Playback**. Diagnosis (do not re-run): `/tmp/nspace-path-playback-rewind-handoff.md`.

---

## 1. Facts from primary source (today)

These are the seams the contract changes; they are not re-diagnosed.

| Seam | Today |
|------|--------|
| Server walk stamp | `maybeBroadcastMoveOrder` sets `startX`/`startZ` from `conn.player`, not `playerPoseNow` ([rooms.ts](../../../server/src/rooms.ts) ~5092). Portals/gates already read analytic pose. |
| Analytic vs tick pose | Gameplay uses `playerPoseNow` → `gameplayPoseFromConn` ([playerPathPose.ts](../../../server/src/playerPathPose.ts)). `conn.player` only advances when the 50 ms tick copies analytic pose (`tickAnalyticPathHuman`). Occupied-room lag widens that gap. |
| Snapshots | `playerToOutState` / `snapshotPlayers` copy live `conn.player`. Full `state` replaces `lastPlayers` ([main.ts](../../../client/src/main.ts)); `stateDelta` merges. |
| Cut stream | `CUT_MOVEMENT_STREAM`: tick `stateDelta` omits pose for in-flight grid walkers ([cutMovementStream.ts](../../../server/src/cutMovementStream.ts)). World Cup field-like free-move **keeps** velocity snapshots. |
| Client playback clock | `refreshRemoteMoveOrderTarget` / `refreshSelfMoveOrderTarget` pass `Date.now()` into `poseAlongPathAtTime`. Elapsed is `max(0, nowMs - startAtMs)` ([pathPosition.ts](../../../client/src/game/pathPosition.ts)). |
| After drain | `moveOrderPlaybackActive` is `pathRemaining > 0`. Drain **deletes** the order; the next `syncState` owns `targetPos` / `selfTargetPos` ([Game.ts](../../../client/src/game/Game.ts) `syncState`). |
| Occupied-room trigger | `chatTyping`, `nimSendIntent`, `setChallenge`, chat send after typing, profile rename, some World Cup bubble paths call `broadcastRoomStateFull` (room-wide pose roster). Empty rooms rarely fire these. |
| Intentional snaps already in code | `applyMoveAbort` snaps and drops the order. Room entry: `setSelf` / `applyRoomFromWelcome` nulls orders and `selfTargetPos`. `shouldSnapCameraOnSelfSync` snaps on establishing target, `!cameraFollowReady`, or jump. Jump: hypot xz `> 6` or `|dy| > 1.5`. World Cup self: `applyMoveOrder` no-ops in free-move rooms. Freeze: `clearConnPathQueue` + `broadcastFrozenStateDelta`. |
| Late joiner | `welcome` / `playerJoined` carry `playerToOutState` only. No in-flight `moveOrder` list. |
| Tab hide | Game does not pause Path Playback on `visibilitychange` (only touch flush). `Date.now()` keeps advancing; rAF `tick` may pause. Resume jumps **forward** along the path, not back. |

Red tests that encode desired behaviour (keep as the TDD seam):

- [client/src/game/pathPlaybackRewind.test.ts](../../../client/src/game/pathPlaybackRewind.test.ts) - observer drain + stale snapshot; clock-ahead drain; replacement order with original `startX`; `nowMs` behind `startAtMs`.
- [server/test/moveOrderStaleStart.test.ts](../../../server/test/moveOrderStaleStart.test.ts) - `buildMoveOrderOutMsg` from unticked `conn.player` vs `gameplayPoseFromConn`.

---

## 2. Locked design (do not reopen)

1. **Server stamps `moveOrder` and pose snapshots from analytic pose** (`playerPoseNow` / `gameplayPoseFromConn`), never from a lagged `conn.player`.
2. **After Path Playback drains, the client ignores snapshot/heartbeat pose that is behind last playback pose**, except **intentional snaps**.
3. **Playback clock is server time** (offset or `serverNowMs` + message age), **not** raw `Date.now()` vs `startAtMs`, so client drain cannot precede server tick catch-up.
4. **Intentional snaps that must still work:** room change, `moveAbort`, Freeze, teleporter, welcome/join, jump threshold `> 6` (and existing `|dy| > 1.5`), World Cup pitch **free-move**.
5. **Do not increase tick pose streaming for laggy clients.** Hold last playback pose + a **low-rate pose heartbeat (~1 Hz)** that is also subject to never-rewind (except implicit abort; see §4).
6. **`chatTyping` and friends must not send full `state`.** Presence-only events are `stateDelta` of the changed player(s), pose fields omitted or ignored under never-rewind. That is both a bandwidth and a rewind-trigger fix.

World Cup field-like rooms stay on snapshot velocity; this contract is for **click-to-walk Path Playback**.

---

## 3. Normative contract

### 3.1 One pose, one clock

- **Authoritative "where is this walker right now"** on the server is always `playerPoseNow(conn, nowMs, …)` while a path is in flight; `conn.player` is a tick cache, not a wire source.
- On every **new accepted walk** (`moveTo`, gate auto-walk, and any other `beginConnPathMove` caller): copy analytic pose into `conn.player` **before** pathfind and **before** `snapshotPathMoveBegin`, then stamp `moveOrder.startX/startZ` from that same pose. Replacement clicks and lagged ticks must not restart observers at the path origin.
- `moveAbort` / Freeze halt / recovery snap: stamp abort pose from analytic pose at emit time (same bug if abort uses stale `conn.player`).
- `playerToOutState` / `snapshotPlayers` / `welcome.self` / `welcome.others` / `playerJoined.player`: pose fields from analytic pose at send time.

### 3.2 Motion wire (click-to-walk)

| Event | Wire | Pose? |
|-------|------|--------|
| Walk accepted / redirected | one `moveOrder` (path, `startX/Z`, `startAtMs`, `speed`, `walkId`, `serverNowMs`) | start = analytic |
| Walk cut | one `moveAbort` (analytic pose + `walkId`) | yes, snap |
| Tick while walking | **no** movement in `stateDelta` (keep `CUT_MOVEMENT_STREAM`) | no |
| Presence (typing, pay intent, challenge, rename, …) | `stateDelta` of **those players only**; do not send `x/y/z/vx/vz` for active or just-drained Path Playback walkers | no |
| Heartbeat | ~1 Hz analytic pose + `walkId` + `walking` for humans with an in-flight path, and for ~1 s after drain | yes, **never-rewind** |
| Join / room change | `welcome` (and the joiner-only echo) includes **in-flight `moveOrder`s** for everyone currently walking, computed from analytic pose + remaining path + original `startAtMs` + `serverNowMs` | yes, intentional |

Do **not** restore 8 Hz tick pose for "this client looks lagged". Heartbeat is the safety net.

`walkId`: monotonic integer per player, incremented on each accepted walk (and cleared/`walking=false` on abort/drain). `startAtMs` is not a stable id (stale reissue reused it).

### 3.3 Playback clock

On every `moveOrder`, heartbeat, and `welcome`:

```
offsetMs = serverNowMs - recvLocalMs
playbackNowMs = localNowMs + offsetMs
elapsed = max(0, playbackNowMs - startAtMs)
```

Refresh the offset whenever a stamped `serverNowMs` arrives. Do not compute elapsed as `Date.now() - startAtMs`.

Consequences:

- Client clock **ahead** of the server cannot drain the path before the server tick has copied analytic pose (fixes occupied-room rewind).
- Client clock **behind** does not freeze at `elapsed = 0` / path origin.
- **Late / retransmitted** orders keep `startAtMs` as the walk's origin time; `serverNowMs` makes elapsed the server's already-walked time (message age alone would restart at `startX`).

`poseAlongPathAtTime` stays the stepper; only `nowMs` passed in changes.

### 3.4 Never-rewind (visual pose)

Keep per avatar (self and remote):

- `lastPlaybackPose` (xz, and y if used)
- `lastWalkId` + last path (for along-path test)
- `playbackActive`

**Along-path "behind":** snapshot/heartbeat pose `S` is behind last playback `L` for walk `W` iff remaining path length from `S` along `W`'s path is **greater** than remaining length from `L` (plus a small epsilon, e.g. arrive eps 0.04). After drain, `L` is at the destination (remaining 0); origin/`conn.player` leftover is behind.

Rules:

1. While `playbackActive`, `syncState` / heartbeat **must not** write pose into `targetPos` / `selfTargetPos` (same as today: `!remoteMoveOrders.has`). Presence flags still apply.
2. When the path drains, **do not** hand pose to the next snapshot. Hold `lastPlaybackPose` until a snapshot/heartbeat is **not** behind, or an intentional snap fires, or a new `walkId` arrives.
3. A **new** `moveOrder` with a **new** `walkId` is a redirect. It may reverse in world space (click back toward origin). That is not rewind. Server `start` must be live analytic pose. Client defence: if the new order's pose at `playbackNowMs` would land behind `lastPlaybackPose` along the **previous** path **and** `walkId` did not increase, ignore it as a stale reissue (test: replacement with original `startX` + fresh `startAtMs`).
4. Clock going backwards (`playbackNowMs` < previous sample): **do not** re-pose earlier on the path; keep last playback sample.
5. Cosmetic / presence traffic (`chatTyping`, nameplates, trails) may update without touching pose.

Never-rewind is **not** "xz is monotonic". Cardinal paths and reverse clicks are allowed.

### 3.5 Intentional snaps (must still work)

These **replace** `lastPlaybackPose`, drop the order, and **may** jump (including backward in world space):

| Snap | How it wins |
|------|----------------|
| Room change | Existing: orders cleared; `setSelf` nulls `selfTargetPos`; first sync establishes pose; `shouldSnapCameraOnSelfSync`. |
| `moveAbort` | Existing: drop order, snap mesh/`targetPos` to abort pose (abort pose must be analytic). |
| Freeze | Abort + `stateDelta` frozen flag. Pose from analytic at halt. Never-rewind does not block abort. |
| Teleporter | Tile test already uses `playerPoseNow`; landing is room change / welcome. |
| Welcome / join | Authoritative roster + in-flight orders. First pose for a new avatar is a snap, not a rewind. |
| Jump `> 6` xz (and existing `|dy| > 1.5`) | Keep hard-snap in `syncState` / `tick`. Use for teleports that did not go through `moveAbort`. |
| World Cup free-move | No Path Playback for self; keep tick velocity snapshots. Never-rewind does not apply. Kickoff reset / pitch teleport stay snaps. |

Same-room admin/script teleport that today sends `broadcastRoomStateFull` after `poseCorrection` abort: still a snap (abort + jump threshold). Prefer abort + delta over a full roster if touching that path, but correctness is the snap, not the roster.

### 3.6 Presence without pose (`chatTyping` and friends)

Stop using `broadcastRoomStateFull` for non-locomotion cues. Send `stateDelta` for the **subject player(s)** with presence fields only (or with pose that the client will ignore under §3.4).

**Friends of `chatTyping` (same bug class):** `nimSendIntent`, `setChallenge` on/off, chat send clearing typing, stale Challenge sweep, field country pick, `syncPlayerProfileDisplayNameForWallet`. Challenge bubbles and typing indicators must not be able to rewind a drained walk.

Keep full `state` only where the roster itself is the event (or until a later slice): tick fallback when delta baseline is missing, and true room-wide resets that already snap (kickoff, same-room teleport). New presence features must not add `broadcastRoomStateFull`.

---

## 4. Failure modes (poor connections)

### 4.1 Packet loss: missed `moveOrder`

CUT stream means **no** tick poses behind the lost order. Recovery, in order:

1. **Duplicate the latest in-flight `moveOrder` at most once** shortly after send (e.g. next tick slot, still not pose streaming). Cheap insurance for a single UDP-like WS drop.
2. **Welcome embed** covers late join / reconnect.
3. **~1 Hz heartbeat** with a **new** `walkId` and analytic pose: client treats as forward catch-up (join the walk mid-path without the polyline). May look stepped until the next `moveOrder` or drain; rare. **Do not** raise tick pose rate.
4. Never-rewind: heartbeat pose that is behind last playback of the **same** `walkId` is ignored.

Observer with no order and no heartbeat yet: hold last known pose (spawn/welcome). No interpolation toward origin.

### 4.2 Packet loss: missed `moveAbort`

Client would keep playing to the old destination. **Never-rewind must not ignore the abort pose** (it is often behind along the old path).

Recovery:

- Heartbeat `walking=false` or `walkId` greater than the playing order → **implicit abort**: snap to heartbeat pose (intentional).
- Next real `moveAbort` or `moveOrder` (new `walkId`) wins.
- Duplicate abort once, same as order duplicate.

A 1 Hz idle heartbeat after halt is enough; do not stream 8 Hz to "fix lag".

### 4.3 Clock skew

Handled by §3.3. Tests: `nowMs` behind `startAtMs` must not hold at origin; clock-ahead drain + stale snapshot must not rewind.

Do not use `performance.now()` against `startAtMs` (epoch vs monotonic mix). Local side of the offset may be `Date.now()` or a monotonic clock as long as it is consistent with `recvLocalMs`.

### 4.4 Tab background

`Date.now()` continues; rAF may pause; WS may still deliver `state` / typing.

- Do not special-case hide as a snap. On resume, playback clock jumps **forward** to server-aligned elapsed (handoff: hide is not the production rewind).
- Buffered full `state` after a hidden drain: never-rewind holds destination.
- If hide lasted past an abort the client missed: first heartbeat/implicit abort snaps (correct).

### 4.5 Bursty jitter

Orders, aborts, and presence `state` can arrive in one burst.

- Apply **in receive order**. `moveAbort` then delayed `moveOrder` with **old** `walkId` is ignored; new `walkId` is a redirect.
- Drain + stale roster in the same burst: never-rewind wins unless the message is an intentional snap.
- Jitter does not justify sending extra tick poses.

### 4.6 Late joiner

Today: stale `conn.player` on `welcome.others` and no path → frozen or origin-teleport until someone types (rewind) or the walk ends.

Contract:

- `welcome` pose is analytic.
- `welcome` (joiner only) includes in-flight `moveOrder`s with `serverNowMs` so playback starts mid-path, not at `startX`.
- `playerJoined` for others already in the room does not need the whole room's paths; the joiner already got them on `welcome`. The joined player, if walking, should include their current `moveOrder` on `playerJoined` **or** rely on welcome-only (joiner) + heartbeat (existing peers already have the order). Prefer: **joiner welcome carries all in-flight orders**; existing peers keep the order they already have.
- Reconnect / room change: same as welcome (intentional snap + fresh orders).

---

## 5. Self vs remotes

Same never-rewind, clock, and `walkId` rules for `selfMoveOrder` and `remoteMoveOrders`.

Self extras that stay:

- `shouldSnapCameraOnSelfSync` on room entry / jump.
- `shouldAdoptServerVelocityOnSelfSync` stays false while playback owns velocity.
- Local click prediction may lead the echo `moveOrder`; the echo must stamp analytic start so the local avatar does not snap back to a lagged `conn.player` origin.

---

## 6. Out of scope

- Movement Watch payloads (admin side channel; ADR 0013 / 0017).
- Raising `STATE_BROADCAST_MIN_MS` pose rate for "bad RTT" clients.
- Protobuf / spatial interest for player pose (bandwidth map may estimate; not required for this contract).
- Changing pathfinding, collision, or room authority beyond "pathfind from analytic pose at accept".
- Implementing production code in this research ticket.

---

## 7. TDD seam (for the next implement session)

Extract a small module (handoff option; preferred over inlining more rules in `Game.syncState`):

- `playbackNowMs(serverNowMs, recvLocalMs, localNowMs)`
- `poseIsBehindAlongPath(lastPose, candidate, path, start)`
- `shouldAdoptSnapshotPose({ playbackActive, behind, intentionalSnap, walkIdChanged, walkingFlag })`

Drive [pathPlaybackRewind.test.ts](../../../client/src/game/pathPlaybackRewind.test.ts) green with: occupied drain + stale snapshot; clock-ahead drain; stale replacement `startX`; clock-behind sample.

Drive [moveOrderStaleStart.test.ts](../../../server/test/moveOrderStaleStart.test.ts) green by stamping `buildMoveOrderOutMsg` from `gameplayPoseFromConn`, not `player.x` after 1 s unticked.

Intentional-snap tests (abort, freeze, welcome establish, jump `> 6`, free-move) must stay green and must not be blocked by never-rewind.
