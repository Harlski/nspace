# Reasons — 0.5.3 (patch-notes version)

**Patch-notes version:** `0.5.3` (frozen via `npm run prepare-merge`).

**Role:** Technical **reasons** attached to **this** patch-notes version — file-level and behavior-level inventory. Public-facing copy at other depths lives only under [public/](public/).

---

## Summary

Teleporter builder overhaul (Set pill, destination picker, landing hints), follow-up teleporter polish (pillar colors, placement rules, linked-pair reposition), seven new achievements, World Cup quick challenge accept, guest-entry HUD move, connect-notice behavior update.

---

## By area

### Repo / docs

- `CONTEXT.md` — **Enter** / **Set** / teleporter glossary terms.
- `docs/THE-LARGER-SYSTEM.md` — linked teleporter pair reposition moves one endpoint only ([reason_920419.md](../../../docs/reasons/reason_920419.md)).
- `docs/build_menu.md`, `docs/features-checklist.md`, `docs/process.md`, `docs/prd/issues/achievements-v3-README.md` — aligned with shipped behavior.
- `docs/reasons/reason_920418.md` — teleporter landing hint + join spawn fallback (prior commit).
- `docs/reasons/reason_920419.md` — linked-pair single-endpoint move.

### Client

- `client/src/ui/teleporterDestPreview.ts` — unified destination picker (room layout + landing hint).
- `client/src/ui/hud.ts` — Set pill anchored to teleporter tile; debounced open; guest entry in Room settings; teleporter color hooks; challenge accept context menu unchanged.
- `client/src/game/Game.ts` — teleporter pillar preview/selection; placement constraint preview; cross-room Enter loading screen; Space triggers Enter/Set; challenge accept tick sprite + pick; linked-pair move client sync.
- `client/src/main.ts` — teleporter Set/Enter wiring; `setChallengeAcceptHandler` → `sendAcceptChallenge`.
- `client/src/game/blockStyle.ts`, `client/src/style.css` — pillar color resolve + Set pill CSS.
- `client/src/net/ws.ts` — `placePendingTeleporter` optional `colorRgb`.
- `client/src/achievements/panelData.ts` — Meta category for AP-threshold achievements.

### Server

- `server/src/teleporterLanding.ts` — landing hint resolution with Join Spawn fallback (prior commit).
- `server/src/rooms.ts` — teleporter configure/place/warp; `movePairedTeleporterEndpointAt`; `placePendingTeleporter` + `setObstacleProps` color; placement validation via grid helpers.
- `server/src/grid.ts` — `teleporterInColumn`, `canPlaceTeleporterAt`.
- `server/src/blockColors.ts` — `TELEPORTER_DEFAULT_PILLAR_COLOR_RGB`, `resolveTeleporterPillarColorRgb`.
- `server/src/achievementDefinitions.ts` — Teleporter Engineer, Room Furnisher, Beat the Creator, They Heard You, Point Hunter I/II.
- `server/src/achievementStore.ts` — AP thresholds, room furnisher hue buckets, teleporter engineer, feedback reply seen.
- `server/src/matchAchievementEvaluator.ts` — `beat_the_creator` when opponent wallet matches creator.
- `server/src/worldcraftAchievementEvaluator.ts` — room furnisher progress on owned-room block place.
- `server/src/connectNotice.ts` — fire on every wallet connect; 1-minute dedupe; display name formatting; skip stream observers.
- `server/src/feedbackTicketStore.ts` — `feedbackTicketHasAdminReply` export.
- `server/src/index.ts` — teleporter landing HTTP/WS (prior commit).

### payment-intent-service

- _(none in this change set)_

### Deploy / ops

- Connect notices: shorter dedupe window (1 minute); more frequent reconnect pings possible. No new env vars.

### Tests

- `server/test/teleporterLanding.test.ts` (prior commit).
- `server/test/teleporterPlacement.test.ts` — column + y-level placement rules.
- `server/test/achievementStore.test.ts`, `server/test/matchAchievementEvaluator.test.ts`, `server/test/connectNotice.test.ts` — new behavior coverage.
