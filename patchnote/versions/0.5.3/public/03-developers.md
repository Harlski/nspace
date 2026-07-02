# Public patch notes — developers (`0.5.3`)

**Audience:** contributors and integrators — APIs, WS messages, module boundaries, notable refactors.  
**Depth:** summarized technical changelog; not a full file list (that stays in [../reasons.md](../reasons.md)).

---

### Teleporters

- Client→server `placePendingTeleporter` accepts optional **`colorRgb`**; locked teleporters allow color-only updates via **`setObstacleProps`**.
- Server landing resolution: `server/src/teleporterLanding.ts` — preferred tile with **Join Spawn** fallback when unwalkable.
- Linked same-room pairs: reposition is **`movePairedTeleporterEndpointAt`** (single endpoint + peer target refresh); gameplay log field **`pairedEndpointMove`**.
- Shared placement helpers in `server/src/grid.ts`: **`teleporterInColumn`**, **`canPlaceTeleporterAt`** (client preview mirrors server).
- Default pillar color: **`TELEPORTER_DEFAULT_PILLAR_COLOR_RGB`** / **`resolveTeleporterPillarColorRgb()`**.

### Achievements

- New definition ids: `teleporter_engineer`, `room_furnisher`, `beat_the_creator`, `they_heard_you`, `point_hunter_1`, `point_hunter_2`.
- **`recordOwnedRoomBlockPlaced`** signature extended for hue-bucket tracking (Room Furnisher).
- **`recordTeleporterActivated()`** on successful teleporter configure / bidirectional pair place.
- AP-threshold achievements evaluated on completion and on **`getAchievementsForWallet`**.
- Match evaluator: **`beat_the_creator`** when opponent wallet matches configured creator address.
- Feedback route fires **`they_heard_you`** when ticket has admin reply (`feedbackTicketHasAdminReply`).

### World Cup client

- **`Game.setChallengeAcceptHandler`** + green tick sprite; **`sendAcceptChallenge`** unchanged on the wire.

### Connect notices

- **`CONNECT_NOTICE_DEDUPE_MS`** = 60_000; fires per connect unless deduped or **`streamObserver`**.

### HUD / Game API

- **`triggerTeleporterDestinationOpen`**, **`triggerPortalEnter`**, teleporter selection color hooks on HUD build surface.
