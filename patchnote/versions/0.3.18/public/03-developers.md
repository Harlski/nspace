# Public patch notes — developers (`0.3.18`)

**Audience:** contributors and integrators — APIs, WS messages, module boundaries, notable refactors.  
**Depth:** summarized technical changelog; not a full file list (that stays in [../reasons.md](../reasons.md)).

---

- **[FIX]** **Main menu** — single `#main-menu-terms-privacy-row` reparented between `#main-menu-terms-privacy-host-default` and `#main-menu-terms-privacy-host-account`; expired-session Re-login sets `expiredReloginTermsPrompt` before `requireTermsChecked()` / `runNimiqWalletSignIn()` (no reset of `termsPrivacyCb` on repeat clicks).
- **[FIX]** **Rendering** — `canUsePlainCubeInstancing` returns false when any `cubeRotX/Y/Z` is set; instanced plain-cube batches keyed by `wyLevel` with `placedBlockStackRenderOrder` and upper-layer `polygonOffset`; selection outline uses `applyPlainCubeMeshRotation` for plain cubes.
