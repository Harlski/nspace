# Reasons — 0.7.5 (patch-notes version)

**Patch-notes version:** `0.7.5` (frozen via `npm run prepare-merge`).

**Role:** Technical **reasons** attached to **this** patch-notes version — file-level and behavior-level inventory. Public-facing copy at other depths lives only under [public/](public/).

---

## Summary

Click-to-walk Path Playback: `walkId` on `moveOrder` / `moveAbort`, `welcome.moveOrders` for late joiners, ~1 Hz analytic `poseHeartbeat` (never-rewind / implicit abort), one-shot order and abort duplicate. Tick pose streaming stays cut. Operator **Chat substitutions**: exact public-chat rewrites (seeded I-variant jokes), CRUD on `/admin/chat`.

---

## By area

### Repo / docs

- [docs/THE-LARGER-SYSTEM.md](../../../docs/THE-LARGER-SYSTEM.md) Path Playback heartbeat + welcome orders; [docs/reasons/reason_192847.md](../../../docs/reasons/reason_192847.md).
- [docs/features-checklist.md](../../../docs/features-checklist.md), [docs/process.md](../../../docs/process.md), [docs/build.md](../../../docs/build.md) — Path Playback wire (`walkId`, `poseHeartbeat`, `welcome.moveOrders`); Chat substitution glossary + admin/env notes in the same docs plus [CONTEXT.md](../../../CONTEXT.md).

### Client

- [client/src/game/moveOrderPlayback.ts](../../../client/src/game/moveOrderPlayback.ts) — `walkId` identity, `shouldAdoptSnapshotPose` walking/walkId flags, `PoseHeartbeatPlayerWire`.
- [client/src/game/Game.ts](../../../client/src/game/Game.ts) — server-clock offset refresh; `applyPoseHeartbeat` implicit abort; welcome in-flight orders via `applyMoveOrder`.
- [client/src/net/ws.ts](../../../client/src/net/ws.ts) / [client/src/main.ts](../../../client/src/main.ts) — `poseHeartbeat`, `welcome.moveOrders`, `walkId`.

### Server

- [server/src/inFlightMoveOrder.ts](../../../server/src/inFlightMoveOrder.ts) — reconstruct order from `pathMove` + original `startAtMs` + send-time `serverNowMs`.
- [server/src/pathPoseHeartbeat.ts](../../../server/src/pathPoseHeartbeat.ts) — ~1 Hz eligibility (in-flight + 1 s after drain; skip field free-move).
- [server/src/moveOrderBroadcast.ts](../../../server/src/moveOrderBroadcast.ts) — required `walkId`; one-shot duplicate helper.
- [server/src/playerPathPose.ts](../../../server/src/playerPathPose.ts) — `overlayGameplayPose`.
- [server/src/chatSubstitutionStore.ts](../../../server/src/chatSubstitutionStore.ts) — exact public-chat substitutions; JSON store; seed three I-variant triggers; CRUD.
- [server/src/rooms.ts](../../../server/src/rooms.ts) — analytic pose on `playerToOutState`; welcome `moveOrders`; heartbeat + duplicate on tick; public `chat` substitutions after trim and before profanity censor (`textOriginal` = typed trigger).
- [server/src/index.ts](../../../server/src/index.ts) — `GET`/`POST /api/admin/chat/substitutions`, `PUT`/`DELETE /api/admin/chat/substitutions/:id`.
- [server/src/adminChatPage.ts](../../../server/src/adminChatPage.ts) — substitutions panel on `/admin/chat`.
- [server/test/chatSubstitutionStore.test.ts](../../../server/test/chatSubstitutionStore.test.ts)
- [server/.env.example](../../../server/.env.example) — `CHAT_SUBSTITUTION_STORE_FILE`.

### payment-intent-service

- _(none in this change set)_

### Deploy / ops

- Default store path is under the existing `server/data` volume (`chat-substitutions.json`). Optional `CHAT_SUBSTITUTION_STORE_FILE`. No new HTML route (Vercel `/api/:path*` already covers the JSON APIs).
