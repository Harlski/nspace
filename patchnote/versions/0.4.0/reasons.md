# Reasons — 0.4.0 (patch-notes version)

**Patch-notes version:** `0.4.0` (frozen via `npm run prepare-merge`).

**Role:** Technical **reasons** attached to **this** patch-notes version — file-level and behavior-level inventory. Public-facing copy at other depths lives only under [public/](public/).

---

## Summary

- **Terms & Privacy:** Static **`/tacs`** and **`/privacy`** (Vite entries `client/tacs.html`, `client/privacy.html`; shared shell + content under `client/src/termsPrivacy/`); **`TERMS_PRIVACY_DOCS_VERSION`** in `client/src/termsPrivacyVersion.ts` and `server/src/termsPrivacyVersion.ts`.
- **Consent:** `POST /api/auth/verify` accepts **`acceptedTermsPrivacyVersion`** (legacy **`acceptedLegalVersion`** still read); **`403`** `terms_privacy_ack_required` + `requiredVersion` when acknowledgement missing or stale; ledger [`server/src/termsPrivacyAcceptanceStore.ts`](../../../server/src/termsPrivacyAcceptanceStore.ts) (default `server/data/terms-privacy-acceptance.json`, merge from legacy `legal-consent.json`); env **`TERMS_PRIVACY_ACCEPTANCE_STORE_FILE`** / **`LEGAL_CONSENT_STORE_FILE`**.
- **Client auth UX:** Main-menu checkbox + modal (`client/src/ui/mainMenu.ts`, `termsPrivacyAckModal.ts`, `authTermsPrivacyVerify.ts`); wallet signing + standalone pages (`walletSigningUi.ts`, analytics/payouts HTML snippets in `server/src/`); shared doc footer HTML (`client/src/ui/docPageSiteFooterHtml.ts`) on legal + patch notes pages (`mountPatchnotesPage.ts`).
- **Patch notes:** Optional **`/patchnotes`** tab **Hotfix** when `public/04-hotfix.md` exists (`client/src/patchnotes/collectPatchnotes.ts`, tests).
- **Rendering:** Claimable (mineable) block sparkle / pulse no longer stall under idle render gating (`client/src/game/Game.ts`: `updateMineableBlockSparkles` + `requestRender` when `visualActive || hasMineableSparkles`).
- **Docs:** `docs/process.md`, `docs/build.md`, `docs/features-checklist.md`, `docs/THE-LARGER-SYSTEM.md`; rationales under `docs/reasons/` including [reason_384729.md](../../../docs/reasons/reason_384729.md) (Hotfix tier) and terms/privacy consent updates as committed.
- **Hotfix (same semver):** Mobile / narrow main-menu **Terms** acknowledgement row — override inherited **`text-align: center`** on `.main-menu__terms-privacy*`; center checkbox with wrapped label; checkbox `padding: 0` (`client/src/style.css`). Public narrative: [public/04-hotfix.md](public/04-hotfix.md).

---

## By area

### Repo / docs

- `docs/THE-LARGER-SYSTEM.md`, `docs/build.md`, `docs/process.md`, `docs/features-checklist.md`, `docs/main-site-design.md` — terms routes, verify body, env vars, patch-note Hotfix tier.
- `docs/reasons/` — companion rationale files for larger-system / consent / Hotfix documentation (see repo for `reason_*.md` added or updated in this release).

### Client

- `client/tacs.html`, `client/privacy.html`, `client/vite.config.ts` — MPA inputs for legal pages.
- `client/src/termsPrivacy/**` — entries, `mountTermsPrivacyPage.ts`, HTML fragments.
- `client/src/termsPrivacyVersion.ts` — docs version string (keep in sync with server).
- `client/src/ui/docPageSiteFooterHtml.ts` — shared footer (Terms · Privacy · Patch notes, contact line).
- `client/src/patchnotes/mountPatchnotesPage.ts` — appends shared footer.
- `client/src/ui/mainMenu.ts`, `client/src/style.css` — terms acknowledgement row before **Enter game**; **hotfix:** `.main-menu__terms-privacy*` left-align + flex cross-axis alignment for consent copy vs checkbox on small viewports (see [public/04-hotfix.md](public/04-hotfix.md)).
- `client/src/ui/walletSigningUi.ts`, `client/src/auth/nimiq.ts`, `client/src/auth/authTermsPrivacyVerify.ts`, `client/src/auth/termsPrivacyAckLocal.ts` — verify payload + acknowledgement flow.
- `client/src/game/Game.ts` — mineable sparkle / emissive updates and render requests when room is otherwise visually idle.
- `client/src/patchnotes/collectPatchnotes.ts`, `client/src/patchnotes/mdToHtml.test.ts` — `04-hotfix` tier ordering and coverage.

### Server

- `server/src/index.ts` — `GET /tacs`, `GET /privacy`; `verify` handler terms/privacy version checks and persistence.
- `server/src/termsPrivacyVersion.ts`, `server/src/termsPrivacyAcceptanceStore.ts`, `server/src/browserTermsPrivacyAuthSnippet.ts` — version constant, JSON store + legacy merge, inlined browser snippet for HTML tool pages.
- `server/src/analyticsAdminPage.ts`, `server/src/analyticsPublicPage.ts`, `server/src/pendingPayoutsPublicPage.ts` — signing UI copy + acknowledgement error handling branches.

### payment-intent-service

- _(none in this change set)_

### Deploy / ops

- Ship new **`dist/tacs.html`** / **`dist/privacy.html`** with the game client build.
- Prefer **`TERMS_PRIVACY_ACCEPTANCE_STORE_FILE`** for the acknowledgement JSON path; legacy filename still supported (see `process.md`).
