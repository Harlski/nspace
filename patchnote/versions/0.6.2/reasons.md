# Reasons — 0.6.2 (patch-notes version)

**Patch-notes version:** `0.6.2` (frozen via `npm run prepare-merge`).

**Role:** Technical **reasons** attached to **this** patch-notes version — file-level and behavior-level inventory. Public-facing copy at other depths lives only under [public/](public/).

---

## Summary

_Add a one-line roll-up here when the buffer gets long._

---

## By area

### Repo / docs

- _(none yet)_

### Client

- [FIX] Admin **Max frustum** in Commons/Hub (and Chamber): `mapOverviewUnlocked` now bypasses the hardcoded hub/chamber frustum caps (18 / etc.) so admin camera zoom limits from the overlay apply; players keep the room caps ([client/src/game/zoomLimits.ts](../../../client/src/game/zoomLimits.ts)).

### Server

- `/analytics` **Chosen flags** panel: `GET /api/analytics/overview` includes `chosenFlags` (`uniqueVisitors`, `withFlag`, `withoutFlag`, `byCountry[]`) via `aggregateChosenFlags` over unique-visitor wallets × `getPlayerCountry` (current Country / profile flag — not location, not Flag Emote usage). UI under Overview: pick-up rate + ranked Twemoji bars (`/flags/<cc>.svg`), top 12 + Show more. ([server/src/analyticsChosenFlags.ts](../../../server/src/analyticsChosenFlags.ts), [server/src/eventLog.ts](../../../server/src/eventLog.ts), [server/src/analyticsPublicPage.ts](../../../server/src/analyticsPublicPage.ts))
- `/analytics` **Nimiq Pay** panel: overview `nimiqPay` — activity cohort (Pay-tagged `session_start` in window), acquisition (`firstTime` = first-ever session was Pay), `returning`, session starts, active play on Pay sessions, NIM payouts to Pay cohort, `byDay` Pay unique + FTU ([server/src/analyticsNimiqPay.ts](../../../server/src/analyticsNimiqPay.ts), [server/src/eventLog.ts](../../../server/src/eventLog.ts), [server/src/analyticsPublicPage.ts](../../../server/src/analyticsPublicPage.ts))
- **Event-loop stall lines now carry GC attribution.** `[event-loop] stall <ms> ending at <ISO>` gains a trailing `(gc <ms> in window: N major, N minor)` / `(gc 0 ms)` summary, computed from a `PerformanceObserver` on GC events over the `performance.now()` timeline (no `--expose-gc`). Lets an operator decide at a glance whether an occasional stall is garbage collection (tune heap/allocation) or application code (add per-op timing to the suspect), without a repro. ([server/src/adminSystemMonitor.ts](../../../server/src/adminSystemMonitor.ts), [docs/nim-payout-tracing.md](../../../docs/nim-payout-tracing.md))

### payment-intent-service

- _(none in this change set)_

### Deploy / ops

- _(none in this change set)_
