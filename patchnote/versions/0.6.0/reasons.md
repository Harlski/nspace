# Reasons — 0.6.0 (patch-notes version)

**Patch-notes version:** `0.6.0` (frozen via `npm run prepare-merge`).

**Role:** Technical **reasons** attached to **this** patch-notes version — file-level and behavior-level inventory. Public-facing copy at other depths lives only under [public/](public/).

---

## Summary

Nimiq Pay tutorial (portrait path, Unlock Pad crossing, Exit Teleporter), Unlock Pad / Attention Marker / No-Walk Floor build tools, floor SV color picker, tutorial off-by-default, mining payout ban hold.

---

## By area

### Repo / docs

- ADR [0005-tutorial-first-contact.md](../../../docs/adr/0005-tutorial-first-contact.md), [0006-tutorial-room-portrait-path.md](../../../docs/adr/0006-tutorial-room-portrait-path.md): Tutorial Room first-contact + south→north portrait **Tutorial Path**.
- ADR [0007-unlock-pad.md](../../../docs/adr/0007-unlock-pad.md), [0008-unlock-pad-settings-dialog.md](../../../docs/adr/0008-unlock-pad-settings-dialog.md), [0012-unlock-pad-crossing-only.md](../../../docs/adr/0012-unlock-pad-crossing-only.md): Unlock Pad domain + admin settings; pad is crossing-only (Hub Exit Teleporter separate).
- ADR [0009-attention-marker-tile-layer.md](../../../docs/adr/0009-attention-marker-tile-layer.md), [0010-unlock-aftermath-teleporter.md](../../../docs/adr/0010-unlock-aftermath-teleporter.md), [0011-no-walk-floor-layer.md](../../../docs/adr/0011-no-walk-floor-layer.md).

### Client

- Unlock Pad: distinct unlocked plate mesh for grant holders; Payment Intent unlock flow (`/api/unlock-pad/*`); admin build-dock Unlock Pad tool + object-panel config; `welcome.unlockedPadInstanceIds` restores grants on reconnect; `nimLuna.ts` amount helpers.
- Attention Marker: admin Buildings tool; glowing bouncing V; Hover Height + Size percent + hue; `setAttentionMarkers` / `attentionMarkers` WS sync; client baseline follows co-occupant top; dock preview contrast for near-white markers.
- No-Walk Floor: Floor dock brush (LMB paint / RMB clear); `noWalkFloorCue.ts` red-X cues while floor mode open.
- Floor tile color: `paletteSvPicker` (SV + hue strip) replaces floor hue ring; HSV helpers in `blockStyle.ts`; hex + eyedropper retained. Objects/sky still on hue ring.
- Floor dock: SV picker sized to tool-card canvas height; Floor / No-Walk / Join Spawn tools; removed Floor-context **Use room center** button; fixed spawn-actions `[hidden]` vs `display:flex`.
- Tutorial flow: `client/src/tutorial/flow.ts`; portal Enter runs `runTutorialDoorPayFlow` for unlock-pad / tutorial-unlock-gate; Step Coach Mine → Pay → Exit.

### Server

- Tutorial learner flow **off by default** (`TUTORIAL_ENABLED` env default false; admin `tutorialEnabled` default false). When on, WS connect forces incomplete Pay wallets into `tutorial` via `resolveInitialRoomForPaySession`. Admins may still join / teleporter-target Tutorial Room while off.
- Reset tutorial / Start over: learners only while feature on; admins anytime in Tutorial Room (incl. completed + feature off). `welcome.tutorialEnabled`; learner HTTP APIs (`door-quote`, `door-sent`, `unstick`, `abandon`, `reset-progress`) allow admins when feature off so Unlock Pad QA works after Reset.
- `tutorialTemplate/bootstrapShell.ts`: default Tutorial Template is 7×15 portrait corridor (Mine alcove south, Unlock Pad mid, Hub Exit Teleporter north); path floor strip; existing block shapes only. Fresh empty template stores pick this up; existing published templates need staging republish / resync.
- Unlock Pad domain module (`server/src/unlockPad/`): per-wallet grants, walkability; tutorial Pay uses Unlock Pad + optimistic door-sent grant; world-anchored Unlock control when adjacent; `forgetUnlockPadInstance` on `removeObstacle`; Payment Intent fulfill (`nspace.unlock_pad`); admin `placeUnlockPad` / `setUnlockPadConfig`.
- Attention Marker domain module (`server/src/attentionMarker/`): parallel tile-keyed layer (ADR 0009); sizePercent; WS place/set/move/remove; Build Shell `attentionMarkers`; room geometry persistence.
- No-Walk Floor domain module (`server/src/noWalkFloor/`): soft-blocked walkability; Hub admin ACL; clear on hole / extra-floor carve; Build Shell + persistence.
- Mining Restriction: `moderationStore.miningBanned`; `payoutMiningGate` holds block-claim mining payouts until lifted; payout-service `miningBanGate` skips send while banned.
- Play-space Join Spawn / ambient sky setters for tutorial-style rooms (`roomLayouts.ts`).

### payment-intent-service

- Feature kind `nspace.unlock_pad` quotes amount from payload (`roomId`, `instanceId`, `amountLuna`).

### Deploy / ops

- Existing deploys with a persisted Tutorial Template keep the old square layout until operators republish from Tutorial Staging (or clear the template store so bootstrap recreates the default).
- Tutorial requires env + admin flag both on for learner routing; bump payment-intent-service with game server for Unlock Pad feature kind.
