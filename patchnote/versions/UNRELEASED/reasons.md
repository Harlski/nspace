# Reasons — UNRELEASED (patch-notes version)

**Patch-notes version:** `UNRELEASED` (working bucket). Before merging to `main`, run `npm run prepare-merge` so this folder is frozen under a semver that matches [package.json](../../../package.json) (see [patchnote/README.md](../../README.md)).

**Role:** Technical **reasons** attached to **this** patch-notes version — file-level and behavior-level inventory. Public-facing copy at other depths lives only under [public/](public/).

---

## Summary

_Add a one-line roll-up here when the buffer gets long._

---

## By area

### Repo / docs

- ADR [0006-tutorial-room-portrait-path.md](../../../docs/adr/0006-tutorial-room-portrait-path.md): Tutorial Room authored as south→north portrait **Tutorial Path**; glossary term in `CONTEXT.md`.

### Client

- Unlock Pad: distinct unlocked plate mesh for grant holders; Payment Intent unlock flow (`/api/unlock-pad/*`); admin build-dock Unlock Pad tool + object-panel config; `welcome.unlockedPadInstanceIds` restores grants on reconnect.
- Unlock Pad Payment Intent: non–Nimiq Pay clients open Hub `checkout` with intent memo as `extraData` (`client/src/unlockPad/pay.ts`); Pay still uses `sendBasicTransactionWithData`.
- Attention Marker: admin Buildings tool; glowing bouncing V; Hover Height + hue; `setAttentionMarkers` / `attentionMarkers` WS sync; client baseline follows co-occupant top.

### Server

- `tutorialTemplate/bootstrapShell.ts`: default Tutorial Template is 7×15 portrait corridor (Mine alcove south, Unlock Pad mid, exit north); path floor strip; existing block shapes only. Fresh empty template stores pick this up; existing published templates need staging republish / resync.
- Unlock Pad domain module (`server/src/unlockPad/`): per-wallet grants, walkability; tutorial Pay uses Unlock Pad + optimistic door-sent grant; world-anchored Unlock control when adjacent; `forgetUnlockPadInstance` on `removeObstacle`; Payment Intent fulfill (`nspace.unlock_pad`); admin `placeUnlockPad` / `setUnlockPadConfig`.
- Attention Marker domain module (`server/src/attentionMarker/`): parallel tile-keyed layer (ADR 0009); WS place/set/move/remove; Build Shell `attentionMarkers`; room geometry persistence.
- `client/src/main.ts`: portal Enter handler runs `runTutorialDoorPayFlow` for unlock-pad / tutorial-unlock-gate.

### payment-intent-service

- Feature kind `nspace.unlock_pad` quotes amount from payload (`roomId`, `instanceId`, `amountLuna`).

### Deploy / ops

- Existing deploys with a persisted Tutorial Template keep the old square layout until operators republish from Tutorial Staging (or clear the template store so bootstrap recreates the default).
