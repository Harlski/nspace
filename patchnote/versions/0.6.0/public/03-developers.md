# Public patch notes — developers (`0.6.0`)

**Audience:** contributors and integrators — APIs, WS messages, module boundaries, notable refactors.  
**Depth:** summarized technical changelog; not a full file list (that stays in [../reasons.md](../reasons.md)).

---

- [NEW] **Unlock Pad** — `server/src/unlockPad/` (grants, walkability, Payment Intent fulfill `nspace.unlock_pad`); HTTP `/api/unlock-pad/*`; WS place/config + `welcome.unlockedPadInstanceIds`; client plate mesh + world-anchored Unlock control. ADRs 0007–0008, 0012 (crossing-only; Exit Teleporter separate).
- [NEW] **Attention Marker** — parallel tile layer (ADR 0009): `server/src/attentionMarker/`, WS place/set/move/remove/`attentionMarkers`, Build Shell field; client `attentionMarkerVisual.ts` (Hover Height, Size 20–100%, hue; preview contrast for light dock bakes).
- [NEW] **No-Walk Floor** — parallel walkability layer (ADR 0011): `server/src/noWalkFloor/`, Hub-admin ACL, clears when carving extra floor; client Floor dock brush + `noWalkFloorCue.ts`.
- [NEW] **Tutorial session** — `tutorialSessionService`, `/api/tutorial/*`, portrait bootstrap `buildDefaultTutorialBootstrapShell` / `TUTORIAL_DEFAULT_BOUNDS` (ADR 0005–0006); defaults off via `isTutorialEnvEnabled` + admin `tutorialEnabled`; `resolveInitialRoomForPaySession` on WS connect.
- [CHANGE] Floor color: `paletteSvPicker.ts` (SV + hue strip) on Room → Floor; `rgbToHsv` / `hsvToRgbNumber` in `blockStyle.ts`. Objects/sky still use hue ring. Wire format remains `colorRgb`.
- [NEW] **Mining ban gate** — `moderationStore.miningBanned`; hold block-claim mining payouts in outbox / payout-service until lifted (`payoutMiningGate` / `miningBanGate`).
- [NEW] Payment Intent feature kind `nspace.unlock_pad` quotes from payload (`roomId`, `instanceId`, `amountLuna`).
