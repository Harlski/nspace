# Handoff: Nimiq Pay First-Contact Tutorial

**Created:** 2026-07-10  
**Branch:** `main` (tutorial shipped in `b7a9554`)  
**Flow:** `/implement` from [docs/PRD-nimiq-pay-tutorial.md](../../docs/PRD-nimiq-pay-tutorial.md)  
**Prior transcript:** [258c672c-5c06-4d8a-a848-5cc464f1bddc](file:///home/johd/.cursor/projects/home-johd-Projects-nspace/agent-transcripts/258c672c-5c06-4d8a-a848-5cc464f1bddc/258c672c-5c06-4d8a-a848-5cc464f1bddc.jsonl)

---

## How to continue (new chat)

Open a fresh session and paste:

```
Continue Nimiq Pay tutorial work from .scratch/handoff/nimiq-pay-tutorial.md
/ask-matt
```

Suggested first action: commit the loading-screen fix, then manual Pay sign-in test.

---

## Goal

Implement the Pay-only first-contact tutorial: shared Tutorial Room, per-wallet mine slot + faucet, optimistic door Pay ack, Hub completion + **First NIM** achievement. Web/Hub wallets skip; post-complete revisit is teleporter-only sandbox.

Full spec: [docs/PRD-nimiq-pay-tutorial.md](../../docs/PRD-nimiq-pay-tutorial.md)

---

## What shipped (`b7a9554`)

**Commit:** `Add Nimiq Pay first-contact tutorial for Pay mini-app sessions.`

### Server (primary seam: `tutorialSessionService`)

| Area | Files |
|------|-------|
| Session + profile | `server/src/tutorialSessionService.ts`, `server/src/playerProfileStore.ts` |
| Config / room IDs | `server/src/tutorial/config.ts`, `server/src/tutorial/roomIds.ts` |
| HTTP routes | `server/src/tutorial/routes.ts` — `GET /api/tutorial/door-quote`, `POST door-sent\|unstick\|abandon` |
| Room wiring | `server/src/tutorial/roomsIntegration.ts`, `server/src/rooms.ts` |
| Template store | `server/src/tutorialTemplate/*` (bootstrap shell, admin REST) |
| Achievement | `server/src/achievementDefinitions.ts` — **First NIM** (`first-nim`, event `tutorial_first_nim`) |
| Auth hook | `server/src/index.ts` — `tutorial.needsTutorial` on verify; route registration |
| Tests | `server/test/tutorialSessionService.test.ts` (8 tests) |

### Client

| Area | Files |
|------|-------|
| Flow helpers | `client/src/tutorial/flow.ts`, `flow.test.ts` |
| Auth type | `client/src/auth/nimiq.ts` — `VerifyAuthResponse.tutorial` |
| Main wiring | `client/src/main.ts` — Pay routing, welcome, gate Pay, escape timer, social suppression |
| UI | `client/src/ui/playerMenu.ts`, `hud.ts`, `mainMenu.ts` |
| WS types | `client/src/net/ws.ts` — `welcome.tutorial` |

### Docs / env

- `docs/features-checklist.md`, `docs/process.md`, `server/.env.example` updated in commit
- Defaults: faucet/door **1000 luna (0.01 NIM)**; `TUTORIAL_*` + `VITE_TUTORIAL_ESCAPE_*`

---

## Uncommitted fix (DO THIS FIRST)

**Symptom:** Nimiq Pay sign-in stuck on "Loading room..." / black screen.

**Cause:** Welcome handler called `playerMenu.setFinishTutorialVisible(...)`. `playerMenu` is not in scope in `main.ts` — throws `ReferenceError` before `hud.setLoadingVisible(false)`.

**Fix (uncommitted in `client/src/main.ts`):**

```diff
- playerMenu.setFinishTutorialVisible(
+ hud.setFinishTutorialVisible(
```

Two branches in the welcome handler (~lines 4787–4803). Client build passes after fix.

```bash
git diff client/src/main.ts   # verify single-line change
cd client && npm run build
# then commit tutorial fix only — do NOT stage unrelated payout/analytics files
```

---

## Open gaps (from PRD vs implementation)

| Item | Status |
|------|--------|
| Guided mine highlight (`mineTile` in 3D) | Not wired on client |
| Admin UI tab for tutorial templates | REST only (`/api/admin/tutorial-templates/*`); no admin rooms page tab |
| Entry toast with identicon | Status text only |
| Hub fade + achievement banner on completion | Partial (`setStatus` only) |
| ADR `docs/adr/000N-tutorial-first-contact.md` | Not created |
| `docs/reasons/reason_*.md` for ADR | Not created |
| CONTEXT.md glossary (Tutorial Room, etc.) | PRD lists terms; `CONTEXT.md` not updated |
| Secondary tests (template store, catalog filter, teleporter, claim rejection) | Minimal |
| `playerMenu.test.ts` | Not updated for Finish tutorial item |

---

## Unrelated dirty tree (do not mix)

These were already modified before/during tutorial work — **not** part of tutorial commit:

- `payout-service/*` (mining ban gate)
- `server/src/analytics*Page.ts`, `payoutDisplayLabels.ts`, `payoutMiningGate.ts`, etc.
- `client/src/analyticsStandalone.ts`, `client/src/style.css`

Stage only tutorial-related paths when committing the loading fix.

---

## Key design decisions (locked in PRD)

- Pay-only first contact; web/Hub skip tutorial
- Shared Tutorial Room + per-wallet mine slot + gate state
- Optimistic door Pay ack (no on-chain verify v1)
- Completion: `doorPaidAt` + Tutorial → Hub (`chamber`); escape/unstick does not complete
- Post-complete revisit: teleporter-only sandbox
- **First NIM** achievement; excluded from Telescope prerequisites (`onboardingComplete.ts`)

---

## Tests

```bash
cd server && npx tsx --test test/tutorialSessionService.test.ts
cd ../client && npm test -- src/tutorial/flow.test.ts
cd server && npm run build
cd ../client && npm run build
```

**Manual acceptance:** Nimiq Pay mini-app — sign in → tutorial room → mine → gate Pay → Hub under ~60s.

---

## Suggested next steps (priority order)

1. **Commit** `hud.setFinishTutorialVisible` fix; verify Pay sign-in loads room
2. **Manual E2E** mine → door Pay → Hub; confirm First NIM unlock
3. **Polish** (optional): mine tile highlight, achievement banner on Hub arrival
4. **Docs:** ADR + reason file + CONTEXT glossary per AGENTS.md / PRD
5. **Patch notes:** UNRELEASED public copy if shipping soon (`/completed-feature-document` or PPA)

---

## Important paths

| What | Where |
|------|-------|
| PRD | `docs/PRD-nimiq-pay-tutorial.md` |
| Server core | `server/src/tutorialSessionService.ts` |
| Client flow | `client/src/tutorial/flow.ts` |
| Bug location | `client/src/main.ts` welcome handler ~4787–4803 |
| Room wiring | `server/src/rooms.ts` — layout seed, welcome, mine claim, gate, completion |
