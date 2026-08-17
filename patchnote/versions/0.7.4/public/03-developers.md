# Public patch notes — developers (`0.7.4`)

**Audience:** contributors and integrators — APIs, WS messages, module boundaries, notable refactors.  
**Depth:** summarized technical changelog; not a full file list (that stays in [../reasons.md](../reasons.md)).

---

- [CHANGE] Presence events (`chatTyping`, chat-clear-typing, `nimSendIntent`, `setChallenge`, challenge timeout, field `setCountry`, profile rename, achievement level) send one-player `stateDelta` via `presenceDeltaPlayers`. CUT-eligible grid walkers omit `x/y/z/vx/vz`.
- [CHANGE] `moveOrder` stamps start from analytic pose (`moveOrderStartFromGameplay`) and includes `serverNowMs`. Client Path Playback uses `playbackNowMs`, holds last pose after drain, and ignores snapshot pose behind that path (`shouldAdoptSnapshotPose`, `shouldAdvancePlaybackSample`, `moveOrderPlaybackFinished`).
- [CHANGE] `mergeStateDeltaPlayer` keeps previous pose when a delta omits coordinates.
- [FIX] `cameraSelfSync` / `syncState` no longer drop active `selfMoveOrder` on camera follow lock-in; `selfPathPlaybackActive` keeps snapshots from owning pose mid-walk.
- [FIX] `remainingAlongPath` skips consumed prefix waypoints so multi-segment walks do not stall at corners or mid-path.
- [FIX] `nimSendIntent` no-ops when `active` is unchanged (same equality guard as typing).
