# Method comparison: movement bandwidth (A–K)

**Date:** 2026-08-18  
**Script:** `node .scratch/movement-bandwidth/compare-methods.mjs` (no deps, throwaway)  
**Production:** not patched  
**Ticket:** [issues/04-compare-optimization-methods.md](../issues/04-compare-optimization-methods.md)

This is a **UTF-8 `JSON.stringify` estimate** of server egress (`payload × N` recipients) and per-client ingress for a click-to-walk room. Same encoding as `broadcast()` in `server/src/rooms.ts`. WebSocket frame headers (~2–8 B) are ignored.

---

## Assumptions (held fixed)

| Knob | Value | Notes |
|---|---|---|
| Occupancy | N = 10, 20, 30 | One room, all connected |
| Window | 60 s | Rates below are per minute |
| Pose broadcast cadence | 120 ms | Only when a method **streams** pose (`STATE_BROADCAST_MIN_MS`) |
| Walk starts | **4 / player / min** | Mean path **8 waypoints**, **3 s**, speed **5** |
| Presence events | **8 chatTyping + 2 challenge/nimSend per room / min** | On+off each count as 1 (a pair is 2). **Room-wide**, not per player. Toggle `presencePerPlayer` in the script to scale ×N |
| Busy walk concurrent | **50%** of N have an in-flight path | Occupancy for omit-pose / heartbeat / spatial |
| Social hub concurrent | **20%** of N | Matches 4×3s / 60s duty cycle |
| Fan-out | Every room message → all N clients | Except method I |
| Spatial visible fraction | **0.4** | **Guess:** ~1/3 of a hub in view; labeled guess |
| Deflate | 40–60% **savings** on repetitive full-state JSON; 10–20% **savings** on tiny unique `moveOrder` | **Guess.** `ws` `WebSocketServer` in `server/src/index.ts` does **not** enable `perMessageDeflate` |
| Protobuf | **40–50% of JSON** size | **Guess.** Naive packed-binary is a sanity check only |

**Duty-cycle inconsistency (stated):** 4 starts/min × 3 s = **20%** walking, which matches social hub. Busy walk keeps **4 starts/min** (as specified) and uses **50% concurrent** only for occupancy-based methods. A physically consistent 50% duty cycle would be 10 starts/min; that is **not** used in the tables.

**Player JSON mix (measured, not captured):** approximates `playerToOutState` — spaced Nimiq address (~44 chars), `recentAliases` always present (often `[]`), four cosmetic keys always present (`null` or id), `playerLevel` set. Roster mix 70% typical / 20% one cosmetic / 10% loaded. Walking poses use long JS floats; idle poses are tile integers.

**What method A already does:** Path Playback `moveOrder` + `CUT_MOVEMENT_STREAM` (tick `stateDelta` omits pose for grid walkers). Tick movement bytes ≈ 0. Remaining hot path is `broadcastRoomStateFull` on typing / nimSend / challenge (`rooms.ts`).

---

## Unit sizes (UTF-8 JSON)

| Payload | Bytes |
|---|---:|
| Typical idle `PlayerState` (`playerToOutState`-like) | 236 |
| Typical walking `PlayerState` (long floats) | 307 |
| Same, coords rounded to 3 decimals | 257 |
| Loaded walking (aliases + 4 cosmetics) | 415 |
| Omit `x,y,z,vx,vz` | 203 |
| Compact PlayerState keys | 148 |
| Drop null cosmetics + empty `recentAliases` | 125 |
| Slim pose `{t:"p",a,x,z,y,vx,vz}` (compact address) | 154 |
| Slim pose, 3-decimal coords | 104 |
| `stateDelta` of one typing player | 296 |
| Same, subject is walking (full clone) | 367 |
| Same, pose omitted | 263 |
| `moveOrder` 8 waypoints | 375 |
| Same, `startX/Z` rounded 3dp | 351 |
| `moveAbort` | 107 |
| Full `state` N=10 / 20 / 30 idle mix | 2589 / 5150 / 7711 |
| Full `state` N=30, 50% walking (floats) | 8772 |
| Same, walker pose omitted | 7211 |
| Naive packed binary: slim pose / 8-wp order / idle player | 57 / 98 / 68 |

Tried numerically, not in the A–K table: dropping null cosmetics and empty alias arrays shrinks a typical idle player **236 → 125** (about the same as compact keys, no new vocabulary).

**Empirical zlib** (`deflateRawSync`, independent messages): full `state` compresses to **18% / 11% / 9%** of JSON at N=10/20/30; four concatenated dumps (context-takeover proxy) to **~3–5.5%**. A unique 8-wp `moveOrder` compresses to **~47%**. The prescribed J guess (50% save on full-state, 15% on orders) is **conservative** vs this one-shot zlib; real `permessage-deflate` with context takeover would land closer to the concat figure for repetitive dumps, and still help orders less.

---

## Method definitions (vs A)

| | What changes |
|---|---|
| **A** | Today: Path Playback + cut stream + **full roster `state`** on each presence event |
| **B** | Presence sends `stateDelta` of **the one player** (still a full `PlayerState` object) |
| **C** | B + omit `x,y,z,vx,vz` on that delta when the subject has an in-flight path |
| **D** | C + omit pose from **any** leftover full `state` for active walkers (rewind belt). Steady 60 s occupancy has no extra full dumps, so **bytes ≈ C** |
| **E** | Counterfactual: keep A, **and** stream slim `{t:"p"}` at 120 ms for concurrent walkers (cut-stream off). Not a savings vs A |
| **F** | A + round coords to 3 decimals |
| **G** | A + compact keys on `PlayerState` (and `type`/`players` on the envelope) |
| **H** | A + **1 Hz** batched slim pose for concurrent walkers (**adds** bytes) |
| **I** | A + movement messages only to **0.4 N** clients (**guess**). Presence stays room-wide |
| **J** | A + prescribed deflate savings (**guess**) |
| **K** | A × 0.45 (**guess** protobuf) |

---

## Busy walk (50% concurrent, 4 starts/min, 10 presence events/min)

Server KiB/min and per-client KiB/min. vs A at N=30.

| Method | N=10 server | N=20 | N=30 | N=10 /client | N=20 /client | N=30 /client | vs A N=30 |
|---|---:|---:|---:|---:|---:|---:|---:|
| A | 434 | 1730 | 3888 | 43.4 | 86.5 | 129.6 | 0% |
| B | 179 | 651 | 1416 | 17.9 | 32.5 | 47.2 | −64% |
| C | 174 | 641 | 1400 | 17.4 | 32.0 | 46.7 | −64% |
| D | 174 | 641 | 1400 | 17.4 | 32.0 | 46.7 | −64% |
| E | 4321 | 17072 | 38268 | 432 | 854 | 1276 | **+884%** |
| F | 400 | 1594 | 3582 | 40.0 | 79.7 | 119.4 | −8% |
| G | 346 | 1378 | 3100 | 34.6 | 68.9 | 103.3 | −20% |
| H | 900 | 3571 | 8014 | 90.0 | 179 | 267 | **+106%** |
| I | 346 | 1378 | 3097 | 34.6 | 68.9 | 103.2 | −20% |
| J | 268 | 1070 | 2406 | 26.8 | 53.5 | 80.2 | −38% (guess) |
| K | 195 | 778 | 1750 | 19.5 | 38.9 | 58.3 | −55% (guess) |

N=30 part split (server KiB/min): A is **1318 `moveOrder` + 2570 presence**. B leaves the 1318 and cuts presence to **97**. After B, leftover traffic **is the path orders**, quadratic in N.

---

## Social hub (20% concurrent, same starts + same 10 presence events/min)

| Method | N=10 server | N=20 | N=30 | N=10 /client | N=20 /client | N=30 /client | vs A N=30 |
|---|---:|---:|---:|---:|---:|---:|---:|
| A | 413 | 1647 | 3702 | 41.3 | 82.4 | 123.4 | 0% |
| B | 177 | 647 | 1409 | 17.7 | 32.3 | 47.0 | −62% |
| C | 175 | 643 | 1403 | 17.5 | 32.1 | 46.8 | −62% |
| D | 175 | 643 | 1403 | 17.5 | 32.1 | 46.8 | −62% |
| E | 2029 | 7907 | 17633 | 203 | 395 | 588 | **+376%** |
| F | 394 | 1570 | 3529 | 39.4 | 78.5 | 117.6 | −5% |
| G | 325 | 1296 | 2914 | 32.5 | 64.8 | 97.1 | −21% |
| H | 607 | 2398 | 5374 | 60.7 | 120 | 179 | **+45%** |
| I | 325 | 1296 | 2911 | 32.5 | 64.8 | 97.0 | −21% |
| J | 258 | 1029 | 2313 | 25.8 | 51.4 | 77.1 | −38% (guess) |
| K | 186 | 741 | 1666 | 18.6 | 37.1 | 55.5 | −55% (guess) |

Busy vs social barely moves A–D: walk *starts* are the same 4/min, and presence is room-wide. Occupancy mainly changes E / H / I / omit-pose fractions.

---

## Sensitivity / stacked (same 60 s model)

| Variant | What | N=30 busy vs A | N=30 social vs A |
|---|---|---:|---:|
| D-on-A | Omit walker pose inside **full** roster dumps (no B) | −12% | −5% |
| E-fullCloneStream | 120 ms **full `PlayerState` clones** for walkers | +1831% | +751% |
| H-fullClone | 1 Hz heartbeat as full clones, not slim | +220% | +90% |
| J-empirical | Independent `deflateRaw` on this JSON | −78% | −77% |
| K-packed | Naive struct packing (not protobuf) | −72% | −71% |
| G-dropNulls | Omit null cosmetics + empty aliases | −21% | −22% |
| B+C+D | Recommended JSON stack | −64% | −62% |
| B+I | B + 0.4 movement fan-out | −84% | −83% |
| B+C+D+H | Recommended stack + 1 Hz slim heartbeat | +42% | −17% |
| B+J | B + prescribed deflate guess | −70% | −69% |
| B+K | B + 45% protobuf guess | −84% | −83% |

After B, **I / K / J-empirical** all land near **~0.6 MiB/min** at N=30 by shrinking the leftover `moveOrder` fan-out or encoding. They are not interchangeable on risk.

---

## Correctness risk (short)

| Method | Risk | Why |
|---|---|---|
| A | **High (today)** | Full `state` carries stale `conn.player` pose; occupied-room Path Playback **rewind** after client drain (`pathPlaybackRewind.test.ts`) |
| B | **Low** | Same shape as achievement level-up `stateDelta`. Client already merges by address. Idle pose still on the delta (fine) |
| C | **Low–med** | Client must **not** treat missing pose as 0. Need merge rules. Fixes rewind for the typing walker |
| D | **Low**, high value | Closes leftover `type:"state"` rewind (join-time dumps, sendFull fallback). Bytes ≈ C in this window |
| E | **High + expensive** | Re-introduces 8.33 Hz pose. Slim is ~half a full clone (154 vs 307) and still **~10× A** at N=30 busy. Fights Path Playback |
| F | **Very low** | 3 dp is sub-millitile. Path waypoints are already ints; win is walker floats + `startX/Z` |
| G | **Med** | Dual vocabulary or a flag day. Drop-nulls gets similar bytes **without** renaming |
| H | **Med–high** | Adds bytes. A **stale** heartbeat recreates rewind unless the client **rejects backward pose** (issue 03). Use analytic pose only |
| I | **High** | 0.4 is a guess. Avatars approaching from off-screen disappear; nameplates / typing / challenge UX is room-scoped on purpose. Terrain interest is already 32-tile chunks (`interestChunks.ts`); this would be a second, player-level filter |
| J | **Med (ops)** | Guess 40–60% save. Empirical zlib is better on full-state, weaker on unique orders. CPU + memory on the event loop; `ws` default is off for a reason |
| K | **High (eng)** | Full codec + framing + rollout. FUTURE_PROTO deferred this. Naive packing (~28–45% of JSON) supports the 40–50% **size** guess, not the cost |

---

## CPU (structural, not a benchmark)

`broadcast()` JSON.stringifies **per recipient** after `filterPresenceOutMsgForViewer` (`rooms.ts` ~4458). Full `state` is O(N) encode **× N sends**.

At N=30, one typing toggle today: **30 × stringify(~8–9 KiB)** plus 30 writes. Method B: **30 × stringify(~300 B)**. Encode work on the social hot path drops from ~N²|PlayerState| to ~N|one player|.

Tick still runs at 20 Hz and still `snapshotPlayers()` / equality-compares up to 8.33 Hz when walkers make the room dirty, even when CUT_MOVEMENT_STREAM **sends nothing**. Walking rooms keep that CPU; B/C/D do not remove it.

J/K add codec CPU on every remaining frame. Path Playback already deleted the 8.33 Hz pose encode; do not buy it back with E.

Optional later: stringify-once when the filtered payload is identical for non-admin viewers.

---

## How to read the leftover

With 4 walks/player/min, **after B** the 60 s budget at N=30 is ~**1.4 MiB/min server** (~47 KiB/min per client), of which ~**94% is `moveOrder`**. C/D are almost free in bytes and are the rewind fix. Compact keys, rounding, and protobuf-on-presence barely matter until orders shrink (I, compact path encoding, or a codec on the order itself).

If presence events were **per player** (script flag), A's presence term would scale another ×N (O(N³) dumps) and B's relative win would look even larger. Default is per-room because 8 typing events/min/person in a 30-person hub is not a plausible social model.

---

## Re-run

```bash
node .scratch/movement-bandwidth/compare-methods.mjs
```

Edit the `ASSUMPTIONS` object at the top to change rates, concurrent fractions, or the spatial/deflate/proto guesses.
