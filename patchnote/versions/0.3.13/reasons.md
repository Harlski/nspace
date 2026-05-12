# Reasons — 0.3.13 (patch-notes version)

**Patch-notes version:** `0.3.13` (frozen via `npm run prepare-merge`).

**Role:** Technical **reasons** attached to **this** patch-notes version — file-level and behavior-level inventory. Public-facing copy at other depths lives only under [public/](public/).

---

## Summary

Deploy hook SSH step tolerates **404** on pre-restart **curl**. Claimable-block mining: context-menu **Mine** uses a longer server hold and a red timing hint; primary-click mining restored; inactive blocks show avatar feedback; self floating action text uses a single instant-replace slot.

---

## By area

### Repo / docs

- [docs/process.md](../../../docs/process.md) — `beginBlockClaim.claimIntent` slugs and per-intent hold behavior (`direct_adjacent_click` vs `world_ctx_*`).
- [docs/features-checklist.md](../../../docs/features-checklist.md) — claimable mining UX (primary click, menu suffix, cooldown message, hover removal).

### Client

- [client/src/game/Game.ts](../../../client/src/game/Game.ts) — Walk mode: primary click on **active** claimable solid blocks calls `performClaimBlockAtWorld` with `direct_adjacent_click` (adjacent) or `world_ctx_auto_walk` (pathfind); **inactive** claimable solid blocks → `showSelfPlayerActionMessage("There's no NIM left here :(")`. Removed canvas **title** hover for mineable blocks. Self-player floating feedback: reserved map key `__self_player_action__`, `removeFloatingTextEntry` + immediate respawn on repeat (no fade queue). Refactored plain floater spawn via `addFloatingTextFromCanvas` / `spawnPlainFloatingTextAt`; `dispose` clears all `floatingTexts`.
- [client/src/ui/worldContextMenu.ts](../../../client/src/ui/worldContextMenu.ts) — Optional `labelSuffix` + `suffixClass` on menu items.
- [client/src/ui/hud.ts](../../../client/src/ui/hud.ts) — World tile context menu **Mine** row: red suffix `(50% ↑ time)`.
- [client/src/style.css](../../../client/src/style.css) — `.other-player-ctx__item-suffix--mine-timing` (red suffix).
- [client/src/main.ts](../../../client/src/main.ts) — Unchanged wiring for `world_ctx_adjacent` / `world_ctx_auto_walk` on context menu Mine (paths still set there).

### Server

- [server/src/rooms.ts](../../../server/src/rooms.ts) — `BLOCK_CLAIM_CONTEXT_MENU_MINE_INTENTS` (`world_ctx_adjacent`, `world_ctx_auto_walk`): `blockClaimOffered.holdMs` and per-session `holdMsRequired` use **1.5×** `BLOCK_CLAIM_HOLD_MS`; `completeBlockClaim` compares `accumAdjacentMs` to `holdMsRequired`. Other intents (e.g. `direct_adjacent_click`) keep default hold. `BlockClaimSession` gains `holdMsRequired`.

### payment-intent-service

- _(none in this change set)_

### Deploy / ops

- [`.github/workflows/deploy-docker.yml`](../../.github/workflows/deploy-docker.yml): pre-deploy **`curl`** no longer uses **`-f`** so HTTP **404** (old binary without hook, or hook `not_configured`) does not fail the SSH step under **`script_stop: true`**; **200** → **60s** wait, **404** → short skip, other → **5s** then continue.
