# Public patch notes — developers (`0.3.9`)

**Audience:** contributors and integrators — APIs, WS messages, module boundaries, notable refactors.  
**Depth:** summarized technical changelog; not a full file list (that stays in [../reasons.md](../reasons.md)).

---

- [NEW] **`/patchnotes` Hotfix tier** — Optional `public/04-hotfix.md` per semver; `PATCHNOTE_TIER_ORDER` in `client/src/patchnotes/collectPatchnotes.ts`.
- [FIX] **Mineable VFX under idle render gating** — `Game.tick`: `updateMineableBlockSparkles()` always runs when any mineable sparkle group exists; `requestRender(250)` merges `visualActive` with that signal (`client/src/game/Game.ts`).
