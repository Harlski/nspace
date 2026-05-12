# Public patch notes — developers (`0.3.13`)

**Audience:** contributors and integrators — APIs, WS messages, module boundaries, notable refactors.  
**Depth:** summarized technical changelog; not a full file list (that stays in [../reasons.md](../reasons.md)).

---

- [CHANGE] **`beginBlockClaim` hold** — `blockClaimOffered.holdMs` and the `completeBlockClaim` adjacent-time gate are driven by per-session `holdMsRequired`. Intents **`world_ctx_adjacent`** and **`world_ctx_auto_walk`** use **1.5×** `BLOCK_CLAIM_HOLD_MS`; **`direct_adjacent_click`** (primary click while adjacent) uses the default hold. See [docs/process.md](../../../../docs/process.md).
- [CHANGE] **Client** — `Game.showSelfPlayerActionMessage` uses a single `floatingTexts` slot (`__self_player_action__`); a new message removes the previous sprite immediately. Plain floating text spawn is shared via `addFloatingTextFromCanvas` / `spawnPlainFloatingTextAt`.
- [OPS] **`.github/workflows/deploy-docker.yml`** — pre-stop `curl` to `POST /api/hooks/pre-deploy-restart` omits **`-f`** so **404** does not fail `script_stop` SSH steps.
