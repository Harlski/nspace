# Reasons — 0.6.4 (patch-notes version)

**Patch-notes version:** `0.6.4` (frozen via `npm run prepare-merge`).

**Role:** Technical **reasons** attached to **this** patch-notes version — file-level and behavior-level inventory. Public-facing copy at other depths lives only under [public/](public/).

---

## Summary

Tutorial Pay/desktop Hub + confirm + progress track + step cinematics; claim-id dedupe append-only (outbox + payout-service) to cut mining stalls. **Hotfix:** tutorial Pay escape default extended to 2 minutes.

---

## By area

### Repo / docs

- _(none yet)_

### Client

- **Tutorial Unlock Pad Pay works on desktop / Hub login.** `sendTutorialDoorPayment` ([client/src/tutorial/flow.ts](../../../client/src/tutorial/flow.ts)) now falls back to **Nimiq Hub `checkout`** when no `window.nimiqPay` host is injected (mirrors `sendUnlockPadPaymentIntent`), instead of returning `pay_unavailable`. Local DEV without a Pay host still simulates an optimistic send. Cancel detection widened (abort/denied/dismiss/closed).
- **Transaction confirm dialog before Pay.** New reusable promise-based `hud.showConfirm(...)` ([client/src/ui/confirmDialog.ts](../../../client/src/ui/confirmDialog.ts), overlay + wiring in [client/src/ui/hud.ts](../../../client/src/ui/hud.ts)) resolves `true`/`false`. `runTutorialDoorPayFlow` ([client/src/main.ts](../../../client/src/main.ts)) shows it ("Send X NIM to unlock…") between quote fetch and send; Cancel/Escape/backdrop abort without paying. Reuses the `external-visit-confirm` styling (no new CSS).
- **Tutorial gate control relabeled "Unlock" (was "Unlock Pad").** `TUTORIAL_UNLOCK_GATE_LABEL` + Step Coach / post-mine hint copy updated ([client/src/tutorial/flow.ts](../../../client/src/tutorial/flow.ts), [client/src/main.ts](../../../client/src/main.ts)).
- **Tutorial Step Coach → compact milestone progress track.** Replaces numbered Mine · Pay · Exit chips with labeled nodes above a fillable connector line (green check / gold current ring / muted next). Connectors animate `scaleX` when a step completes (~360ms). Compact strip height; no Start over on the coach (reset stays Player Menu only). Hint tints the word Unlock. CSS in [client/src/style.css](../../../client/src/style.css); markup/wiring in [client/src/ui/hud.ts](../../../client/src/ui/hud.ts).
- **Tutorial step cinematics.** `hud.showTutorialCinematic(title)` full-letterbox title card (veil + blur/scale-in, ~2.8s hold, queued). Fired once per step advance: Mine → “You just earned NIM”, Pay → “You just spent NIM”, Hub Exit → “Welcome to Nimiq Space” (`TUTORIAL_CINEMATIC_TITLES`). NIM / brand words tinted. Exit teleporter arms `pendingTutorialHubWelcome` (same as doors); cinematic flushes **after** the Hub load veil clears so it is not spent under black.
- **Hotfix — Tutorial Pay escape wait extended to 2 minutes.** Default `TUTORIAL_ESCAPE_MS` / `VITE_TUTORIAL_ESCAPE_MS` is now **120000** (was 10000); countdown window default **10000** (was 5000). Still overridable via env ([client/src/tutorial/flow.ts](../../../client/src/tutorial/flow.ts)).

### Server

- **Claim-id dedupe append-only** — `delivered-claim-ids.jsonl` instead of rewriting the full JSON array on every outbox delivery; one-shot migrate from `delivered-claim-ids.json` → `.jsonl` + `.pre-jsonl.bak` ([server/src/payoutOutbox.ts](../../../server/src/payoutOutbox.ts)). Was causing multi-MB sync writes and frequent `[event-loop] stall` under mining (~197k ids / 6.1 MB in prod).

### payment-intent-service

- _(none in this change set)_

### payout-service

- **Accepted-claim-ids append-only** — same pattern as game outbox: `accepted-claim-ids.jsonl` + legacy JSON migrate ([payout-service/src/queue.ts](../../../payout-service/src/queue.ts)).

### Deploy / ops

- After deploy, confirm migration log lines once; monitor stall rate and `iotop` write bandwidth (see [docs/nim-payout-tracing.md](../../../docs/nim-payout-tracing.md)).
- **Hotfix:** Client builds that omit `VITE_TUTORIAL_ESCAPE_*` pick up the new 2 min / 10 s countdown defaults. Override only if you need a different escape window (`server/.env.example`).