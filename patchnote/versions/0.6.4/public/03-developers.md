# Public patch notes — developers (`0.6.4`)

**Audience:** contributors and integrators — APIs, WS messages, module boundaries, notable refactors.  
**Depth:** summarized technical changelog; not a full file list (that stays in [../reasons.md](../reasons.md)).

---

- [FIX] `sendTutorialDoorPayment` falls back to Nimiq Hub `checkout` when `window.nimiqPay` is absent (desktop / Hub login); only local DEV simulates without a Pay host.
- [NEW] `hud.showConfirm(request): Promise<boolean>` — reusable confirm dialog; tutorial Pay gates the send behind it.
- [NEW] `hud.showTutorialCinematic(title)` — full-letterbox step beats; titles in `TUTORIAL_CINEMATIC_TITLES`. Exit Teleporter and door paths arm Hub welcome; cinematic flushes after the load veil clears.
- [CHANGE] Tutorial Step Coach is a compact milestone track (labeled nodes + animated connector fill). `TUTORIAL_UNLOCK_GATE_LABEL` is `"Unlock"`. Start over removed from coach chrome (Player Menu reset unchanged). `TutorialCoachState` API unchanged.
- [PERF] Claim-id dedupe: `delivered-claim-ids.jsonl` / `accepted-claim-ids.jsonl` append one id per claim; startup migrates legacy JSON arrays once (`server/src/payoutOutbox.ts`, `payout-service/src/queue.ts`).
- [CHANGE] `TUTORIAL_ESCAPE_MS` default **120000**; `TUTORIAL_ESCAPE_COUNTDOWN_MS` default **10000** (`client/src/tutorial/flow.ts`).
