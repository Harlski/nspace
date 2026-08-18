# Public patch notes — developers (`0.7.5`)

**Audience:** contributors and integrators — APIs, WS messages, module boundaries, notable refactors.  
**Depth:** summarized technical changelog; not a full file list (that stays in [../reasons.md](../reasons.md)).

---

- [NEW] Chat substitutions: exact match after trim (no case folding, substring, or regex). Public `chat` only; `applyStoredChatSubstitution` runs before `censorChat`. Admin JSON: `GET`/`POST /api/admin/chat/substitutions`, `PUT`/`DELETE /api/admin/chat/substitutions/:id` (system admin). Errors: `empty_trigger`, `empty_replacement`, `duplicate_trigger`, `not_found`.
- [CHANGE] `moveOrder` / `moveAbort` carry `walkId` (monotonic per player). A new id is a redirect; the same id behind last playback is a stale reissue.
- [CHANGE] `welcome.moveOrders` embeds in-flight Path Playback walks (original `startAtMs` + send-time `serverNowMs`) so joiners start mid-path.
- [NEW] `poseHeartbeat` (~1 Hz analytic pose + `walkId` + `walking`) for grid walkers and ~1 s after drain. Client never-rewind; `walking=false` or a greater `walkId` is an implicit abort.
- [CHANGE] `playerToOutState` / snapshots overlay analytic pose. Latest `moveOrder` / `moveAbort` is duplicated once on the next tick.
- [CHANGE] Client Path Playback refreshes the `serverNowMs` clock offset on stamped messages (`shouldAdoptSnapshotPose` walking/walkId flags).
