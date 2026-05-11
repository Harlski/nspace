# Public patch notes — developers (`0.4.0`)

**Audience:** contributors and integrators — APIs, WS messages, module boundaries, notable refactors.  
**Depth:** summarized technical changelog; not a full file list (that stays in [../reasons.md](../reasons.md)).

---

- [NEW] **`POST /api/auth/verify`** — optional **`acceptedTermsPrivacyVersion`** (legacy **`acceptedLegalVersion`**); **`403`** **`terms_privacy_ack_required`** with **`requiredVersion`** when the wallet has not accepted the bundled docs version (`server/src/termsPrivacyVersion.ts`).
- [NEW] Ledger — [`termsPrivacyAcceptanceStore`](../../../../server/src/termsPrivacyAcceptanceStore.ts); keep client + server **`TERMS_PRIVACY_DOCS_VERSION`** aligned with prose under **`client/src/termsPrivacy/content/`**.
- [NEW] **`/patchnotes` Hotfix tier** — Optional **`public/04-hotfix.md`** per semver; **`PATCHNOTE_TIER_ORDER`** in **`client/src/patchnotes/collectPatchnotes.ts`**.
- [FIX] **Mineable VFX vs idle render gating** — **`Game.tick`**: **`updateMineableBlockSparkles()`** runs when sparkle groups exist; **`requestRender(250)`** when **`visualActive || hasMineableSparkles`** (`client/src/game/Game.ts`).
- [FIX] **Main-menu Terms row (mobile)** — **`client/src/style.css`**: `.main-menu__terms-privacy*` **`text-align: left`**, label **`align-items: center`**, custom checkbox **`padding: 0`**; see **Hotfix** tier copy for **`0.4.0`**.
