# Reasons — 0.6.1 (patch-notes version)

**Patch-notes version:** `0.6.1` (frozen via `npm run prepare-merge`).

**Role:** Technical **reasons** attached to **this** patch-notes version — file-level and behavior-level inventory. Public-facing copy at other depths lives only under [public/](public/).

---

## Summary

Tutorial Path + Unlock Pad / Attention Marker work; analytics unique-visitor chart + overview cache; payout outbox compaction to stop idle event-loop stalls.

---

## By area

### Repo / docs

- ADR [0006-tutorial-room-portrait-path.md](../../../docs/adr/0006-tutorial-room-portrait-path.md): Tutorial Room authored as south→north portrait **Tutorial Path**; glossary term in `CONTEXT.md`.

### Client

- Unlock Pad: distinct unlocked plate mesh for grant holders; Payment Intent unlock flow (`/api/unlock-pad/*`); admin build-dock Unlock Pad tool + object-panel config; `welcome.unlockedPadInstanceIds` restores grants on reconnect.
- Unlock Pad Payment Intent: non–Nimiq Pay clients open Hub `checkout` with intent memo as `extraData` (`client/src/unlockPad/pay.ts`); Pay still uses `sendBasicTransactionWithData`.
- Attention Marker: admin Buildings tool; glowing bouncing V; Hover Height + hue; `setAttentionMarkers` / `attentionMarkers` WS sync; client baseline follows co-occupant top.

### Server

- `/analytics` unique-visitors stacked bars: fill height now includes wallets omitted by the 20/direction detail-list cap (grey "other" segment), so bar height matches hover unique counts ([server/src/analyticsVisitorStack.ts](../../../server/src/analyticsVisitorStack.ts), [server/src/analyticsPublicPage.ts](../../../server/src/analyticsPublicPage.ts)).
- `GET /api/analytics/overview`: in-memory TTL cache (`ANALYTICS_OVERVIEW_CACHE_TTL_MS`, default 2 min) + single-pass JSONL scan (was two full passes for first-time login detection) ([server/src/eventLog.ts](../../../server/src/eventLog.ts)).
- Payout outbox: compact delivered lines out of `outbox.jsonl` on startup / after drain; keep undelivered intents in memory so the 2s delivery loop no longer re-parses a growing JSONL (was causing ~400–500 ms `[event-loop] stall` every ~2.5s when idle) ([server/src/payoutOutbox.ts](../../../server/src/payoutOutbox.ts)).
- `tutorialTemplate/bootstrapShell.ts`: default Tutorial Template is 7×15 portrait corridor (Mine alcove south, Unlock Pad mid, exit north); path floor strip; existing block shapes only. Fresh empty template stores pick this up; existing published templates need staging republish / resync.
- Unlock Pad domain module (`server/src/unlockPad/`): per-wallet grants, walkability; tutorial Pay uses Unlock Pad + optimistic door-sent grant; world-anchored Unlock control when adjacent; `forgetUnlockPadInstance` on `removeObstacle`; Payment Intent fulfill (`nspace.unlock_pad`); admin `placeUnlockPad` / `setUnlockPadConfig`.
- Attention Marker domain module (`server/src/attentionMarker/`): parallel tile-keyed layer (ADR 0009); WS place/set/move/remove; Build Shell `attentionMarkers`; room geometry persistence.
- `client/src/main.ts`: portal Enter handler runs `runTutorialDoorPayFlow` for unlock-pad / tutorial-unlock-gate.

### payment-intent-service

- Feature kind `nspace.unlock_pad` quotes amount from payload (`roomId`, `instanceId`, `amountLuna`).

### Deploy / ops

- Existing deploys with a persisted Tutorial Template keep the old square layout until operators republish from Tutorial Staging (or clear the template store so bootstrap recreates the default).
