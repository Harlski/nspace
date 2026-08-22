# Research: user-facing string surfaces (v1 localization inventory)

**Ticket:** [issues/01-inventory-string-surfaces.md](../issues/01-inventory-string-surfaces.md)  
**Question:** What user-facing string surfaces must v1 localization cover, and what is clearly out of map scope?  
**Method:** Primary sources only - repo source + `docs/localization.md`, `docs/brainstorm/localization-implementation-plan.md`, `docs/features-checklist.md`, and the wayfinder map locks in `.scratch/localization/map.md`. No implementation.

**Baseline (docs):** There is **no** i18n framework yet; player-visible copy lives in TypeScript/HTML under `client/src/ui/` (and related), and server-rendered pages build English strings in TypeScript. `client/index.html` uses `lang="en"` only. ([docs/localization.md](../../../docs/localization.md), [docs/brainstorm/localization-implementation-plan.md](../../../docs/brainstorm/localization-implementation-plan.md))

**Product scope locks (map):** In: game UI, achievements, in-game feedback, main-menu / site chrome players see, non-admin server HTML. Out: `/admin/*` and admin-only overlays; user-authored content; third-party chrome. ([.scratch/localization/map.md](../map.md))

---

## Scale (rough, for later sequencing)

| Area | Scale signal | Notes |
|------|----------------|-------|
| `client/src/ui/` | **41** non-test `.ts` modules; **~30k** lines total | Dominated by `hud.ts` (**~18.6k** lines) |
| Other large client hubs | `main.ts` **~8.2k**; `game/Game.ts` **~21k** (few product strings; mostly engine) | Rooms modals, WS error→English maps, status lines live in `main.ts` |
| Achievements | Registry **~1.9k** lines / **~127** `title:` strings in `server/src/achievementDefinitions.ts`; client panel **~500** lines | Titles + descriptions + client category labels |
| World Cup / invite / tutorial | WC **~12** modules / **~2.9k** lines; invite **~1.1k**; tutorial `flow.ts` **~478** | Match HUD, scoreboard, country picker, Play Space lobby |
| Cosmetics wardrobe | `wardrobePanel.ts` **~1.3k** | UI chrome vs admin `displayName` (authored) |
| Non-admin server HTML | `analyticsPublicPage.ts` **~2.7k**; `advertisePage.ts` **~2.5k**; `pendingPayoutsPublicPage.ts` **~364**; `advertiseGuidePage.ts` **~258** | Largest public HTML surfaces |
| Admin server HTML (out) | Multiple `admin*Page.ts` + `analyticsAdminPage.ts` (**~1.2k**) | Explicitly English-only for this map |
| Static legal bodies | `tacs-body.html` **~108** lines; `privacy-body.html` **~113** | Chrome vs legal body still open on the map |
| Planning estimate | “Low thousands of distinct keys” once HUD is extracted | [docs/planning/localization/SCOPE.md](../../../docs/planning/localization/SCOPE.md) (non-ticket primary; aligns with file sizes above) |

**Notable large modules for sequencing (not a plan):** `client/src/ui/hud.ts`, `client/src/main.ts` (rooms + error maps), `server/src/achievementDefinitions.ts`, `server/src/advertisePage.ts`, `server/src/analyticsPublicPage.ts`, `client/src/cosmetics/wardrobePanel.ts`, `client/src/ui/mainMenu.ts`, World Cup HUD cluster.

---

## 1. Game client UI modules (`client/src/ui/` + bootstrap chrome)

### 1.1 Core in-game HUD and menus (in scope)

| Surface | Path | Why player-visible |
|---------|------|-------------------|
| HUD (chat, build dock, overlays, feedback UI shell, status, Action Wheel wiring, many templates) | `client/src/ui/hud.ts` | Primary in-world UI; docs call it out as the largest surface ([docs/brainstorm/localization-implementation-plan.md](../../../docs/brainstorm/localization-implementation-plan.md)) |
| Main menu / lobby | `client/src/ui/mainMenu.ts` | Connect, brand, social entry |
| Player menu | `client/src/ui/playerMenu.ts` | Includes **Feedback** row labels / unread aria |
| Other-player nested menu model | `client/src/ui/otherPlayerMenuModel.ts` | View profile / whisper / more (admin Freeze branch is admin-only; see §5) |
| World / tile context menu | `client/src/ui/worldContextMenu.ts` | Short verb phrases (Mine, Walk here, …) |
| Confirm / leave / navigate dialogs | `confirmDialog.ts`, `leaveGameConfirm.ts`, `navigateAwayConfirm.ts` | Modal copy |
| Username prompt | `usernamePromptModal.ts` | Login UX ([docs/features-checklist.md](../../../docs/features-checklist.md) username prompt) |
| Terms/privacy ack modal | `termsPrivacyAckModal.ts` | Pre-play legal ack chrome |
| Wallet signing UI glue | `walletSigningUi.ts` | Product chrome around Hub/Pay (upstream SDK strings stay third-party; §5) |
| Loading / reconnect feedback | `loadingFeedback.ts` | Status copy |
| Mobile browser play gate | `mobileBrowserPlay.ts` | Play-on-mobile messaging |
| Whisper recipient UI | `whisperRecipients.ts` | Whisper chrome |
| Header marquee **chrome** | `headerMarquee.ts` | Shell/UI around messages; **message body** is admin-authored (see §5 / map open question) |
| Site doc footer | `docPageSiteFooterHtml.ts` | Terms · Privacy · Patch notes labels |
| Main-site nav labels (shared with HTML pages) | `mainSiteNav.ts` | “Payouts”, “Advertise”, group labels; Admin group is operator chrome |
| Pseudo-fullscreen / input shell / telescope control | `pseudoFullscreen.ts`, `inputShell.ts`, `telescopeControl.ts` | Player-facing `aria-label` / hold-to-zoom copy |
| Flags / profile flag chip | `flags.ts`, `profileFlagChip.ts` | Country/flag UI labels as used in profile / WC |
| Emote wheel glyphs | `emoteWheelEmotes.ts` | Emoji-only list (little/no prose; still a surface if labels are added later) |
| Prefab dock / authoring / teleporter / sale / room catalog | `prefabDockPicker.ts`, `objectPrefabAuthoring.ts`, `teleporterDestPreview.ts`, `saleDisplayPanels.ts`, `roomCatalogPreview.ts`, `buildDockContextParams.ts` | Build and commerce chrome players use |
| Palette / hue pickers | `palette*.ts`, `ringHuePick.ts` | Mostly controls; any visible labels/tooltips count |
| Overlay back stack | `overlayBackStack.ts` | Structural; may carry button labels |

### 1.2 Client bootstrap / orchestration with embedded English (in scope)

| Surface | Path | Examples (cited pattern) |
|---------|------|---------------------------|
| App entry + rooms modals + status + WS `error` → English chat | `client/src/main.ts` | Loading room labels; rooms catalog HTML (`aria-label`, placeholders); unlock/tutorial status; `msg.type === "error"` branches mapping codes to System chat ([~6987–7096](../../../client/src/main.ts)) |
| Root HTML meta | `client/index.html` | `lang="en"`, `<title>`, OG description ([docs/localization.md](../../../docs/localization.md)) |
| Floating self-action lines in world | `client/src/game/Game.ts` | e.g. `"I can't move here"`, `"There's no NIM left here :("` ([docs/features-checklist.md](../../../docs/features-checklist.md) mine/walk copy) |
| Stream broadcast overlay copy | wired from `main.ts` / stream helpers | e.g. “Play Nimiq Space at https://nimiq.space” ([docs/features-checklist.md](../../../docs/features-checklist.md) stream cinema) |

### 1.3 UI modules that are admin / opt-in debug (out of product map; listed for boundary)

| Module | Path | Classification |
|--------|------|----------------|
| Admin overlay (Watch, Freeze, build admin tools) | `client/src/ui/adminOverlay.ts` | Admin-only overlay - **out** ([map.md](../map.md), [docs/features-checklist.md](../../../docs/features-checklist.md) Movement Watch / Admin Invisible) |
| Pay touch debugger | `client/src/ui/payTouchDebug.ts` | Opt-in `localStorage` debug - not general player UI |

---

## 2. Achievements / feedback / other player-visible client features

### 2.1 Achievements (in scope)

| Surface | Path | Notes |
|---------|------|-------|
| Code-defined titles & descriptions | `server/src/achievementDefinitions.ts` | ~127 `title:` entries; collection label `ACHIEVEMENT_COLLECTION = "Achievements"`; authority is server registry (see follow-on ticket `04-achievement-string-authority`) |
| Achievements panel UI | `client/src/achievements/panel.ts` | Panel chrome |
| Category / group labels | `client/src/achievements/panelData.ts` | e.g. `CATEGORY_LABELS`, `CATEGORY_GROUP_LABELS`, `TEMPORARILY_UNAVAILABLE_LABEL` |
| Celebration VFX / policy | `celebration*.ts`, `achievementCelebrationVfx.ts` | Mostly non-copy; any toast/banner text if present |

### 2.2 In-game feedback (player UI in scope; admin triage out)

| Surface | Path | Notes |
|---------|------|-------|
| Feedback overlay (New / My feedback, kinds, placeholders) | Embedded in `client/src/ui/hud.ts` | Player-visible product copy |
| Player menu entry | `client/src/ui/playerMenu.ts` | “Feedback”, “Feedback - new reply” |
| Admin feedback console | `server/src/adminFeedbackPage.ts` | **`/admin/feedback` - out** |
| Ticket **message bodies** | User-authored | **Out** ([map.md](../map.md)) |

### 2.3 Other player-visible feature modules (in scope unless noted)

| Feature | Paths | Notes |
|---------|-------|-------|
| World Cup | `client/src/worldcup/*` (`matchHud.ts`, `scoreboard.ts`, `matchCountdown.ts`, `countryPickerModal.ts`, `movementModeToggle.ts`, …) | Match HUD, countdown, country picker; country **display names** may use `Intl.DisplayNames` later (planning SCOPE) |
| Direct invite / Play Space | `client/src/invite/*` (`joinGate.ts`, `lobbyOverlay.ts`, `walletOnboarding.ts`, template picker, …) | Guest + wallet splash / lobby |
| Tutorial | `client/src/tutorial/flow.ts` + unlock status strings in `main.ts` | When tutorial enabled ([docs/features-checklist.md](../../../docs/features-checklist.md)) |
| Unlock Pad | `client/src/unlockPad/*` + HUD/main unlock copy | Product chrome; per-pad `buttonLabel` can be instance-authored (borderline authored - see ticket `06`) |
| Cosmetics wardrobe / shop chrome | `client/src/cosmetics/wardrobePanel.ts`, `wardrobeStyleLines.ts`, `wardrobeSlotTip.ts`, `unlockCheckout.ts`, `saleDisplay*` | UI labels in scope; catalog `displayName` from store/admin is **authored** |
| Ambient cast | `client/src/ambientCast/mountAmbientCast.ts` | Player-facing cast UI if shown in product flows |
| Patch notes SPA | `client/src/patchnotes/mountPatchnotesPage.ts` + bundled `patchnote/versions/*/public/*.md` | **Chrome** (dropdowns, badges) vs **markdown bodies**; planning SCOPE defers body translation ([docs/planning/localization/SCOPE.md](../../../docs/planning/localization/SCOPE.md)); features checklist documents English markdown tiers ([docs/features-checklist.md](../../../docs/features-checklist.md)) |
| Auth client messages | `client/src/auth/nimiq.ts` | Product error/status around verify; Hub/Pay UI remains third-party |
| Server → client system chat (English on wire today) | `server/src/rooms.ts` (`from: "System"`, `text: …`) | Player-visible; planning recommends code→client `t()` over time ([docs/planning/localization/SCOPE.md](../../../docs/planning/localization/SCOPE.md) D5) - still an inventory surface |
| Restart / server notice banner | `serverNotice` / HUD banner path ([docs/features-checklist.md](../../../docs/features-checklist.md)) | Product chrome + optional admin-supplied `message` (authored) |

---

## 3. Non-admin server HTML pages (in scope for map)

Routes from `server/src/index.ts`; HTML builders in `server/src/*Page*.ts`.

| Route | Builder | Scale | Audience note |
|-------|---------|-------|----------------|
| `/payouts` | `server/src/pendingPayoutsPublicPage.ts` (~364 lines) + shell `client/payouts.html` / `pendingPayoutsStandalone.ts` | Medium | Player wallet payout queue ([docs/features-checklist.md](../../../docs/features-checklist.md)) |
| `/advertise` | `server/src/advertisePage.ts` (~2.5k lines) | **Large** | Wallet-gated advertiser dashboard ([docs/features-checklist.md](../../../docs/features-checklist.md)) |
| `/advertise/how-it-works` | `server/src/advertiseGuidePage.ts` (~258 lines) | Small–medium | Public guide copy |
| `/analytics` | `server/src/analyticsPublicPage.ts` (~2.7k lines) + `client/analytics.html` / `analyticsStandalone.ts` | **Large** | **Not** under `/admin/*`, but **wallet allowlist** operator dashboard ([docs/features-checklist.md](../../../docs/features-checklist.md)); map examples emphasize `/advertise`, `/payouts`, guides - treat as non-admin HTML still requiring a product call if v1 should skip allowlisted ops tools |
| Shared main-site chrome helpers | `server/src/analyticsTopbar.ts`, `mainSiteNav` (server + `client/src/ui/analyticsTopbar.ts`, `mainSiteNav.ts`) | Shared | Footer / topbar / nav labels on SSR pages ([docs/main-site-design.md](../../../docs/main-site-design.md)) |

Also cited in docs as localizable SSR examples: `analyticsPublicPage`, `pendingPayoutsPublicPage` ([docs/localization.md](../../../docs/localization.md), brainstorm plan).

---

## 4. Static client HTML - terms / privacy (and related shells)

| Surface | Path | Classification |
|---------|------|----------------|
| Terms entry HTML | `client/tacs.html` (`lang="en"`) | Shell |
| Privacy entry HTML | `client/privacy.html` (`lang="en"`) | Shell |
| Mount chrome (titles, Home aria, layout) | `client/src/termsPrivacy/mountTermsPrivacyPage.ts` | Product chrome - **in** |
| Legal body HTML | `client/src/termsPrivacy/content/tacs-body.html`, `privacy-body.html` | **Open on map** whether v1 translates bodies or only chrome ([map.md](../map.md) “Not yet specified”); brainstorm treats legal as separate unless reviewed ([docs/brainstorm/localization-implementation-plan.md](../../../docs/brainstorm/localization-implementation-plan.md)); planning SCOPE: not Phase 1 success criteria |
| Ack modal (in-game) | `client/src/ui/termsPrivacyAckModal.ts` | Chrome - **in** |
| Site footer links | `client/src/ui/docPageSiteFooterHtml.ts` | “Terms”, “Privacy”, “Patch notes” - **in** |

---

## 5. Explicitly out of scope (admin / user-authored / third-party)

Per [map.md](../map.md) Out of scope + brainstorm “Out of scope for app UI strings” + features checklist admin surfaces.

### 5.1 Admin pages and admin-only client tooling

| Surface | Paths / routes |
|---------|----------------|
| All `/admin/*` HTML | `adminSettingsPage.ts`, `adminSystemPage.ts`, `adminHeaderPage.ts`, `adminFeedbackPage.ts`, `adminCampaignPage.ts`, `adminCosmeticsPage.ts`, `adminRoomsPage.ts`, `adminChatPage.ts`, `adminModerationPage.ts`, `adminUserPage.ts`, …; shells `client/admin.html`, `adminStandalone.ts` |
| `/analytics/admin` | `server/src/analyticsAdminPage.ts` |
| In-game admin overlay | `client/src/ui/adminOverlay.ts` (Movement Watch, Admin Invisible, etc. - [docs/features-checklist.md](../../../docs/features-checklist.md)) |
| Admin cosmetic preview shell | `client/adminCosmeticPreview.html` |
| Admin-only other-player actions | Freeze / Unfreeze labels under Administrative ([docs/features-checklist.md](../../../docs/features-checklist.md)) - keep English with admin tooling |

### 5.2 User-authored / admin-authored content (not product catalog)

| Content | Where it appears |
|---------|------------------|
| Chat messages, whispers | Client chat log; server may censor/substitute but body is user text |
| Usernames | Profile / nameplates |
| Signboard / voxel / in-world labels | World content |
| Campaign project name, URL, image, advertiser-entered fields | `/advertise` + in-world billboards ([docs/features-checklist.md](../../../docs/features-checklist.md)) |
| Header marquee `newsMessages` | Admin-authored; map leaves as authored language vs multi-locale admin fields later |
| Cosmetic catalog `displayName` | `server/src/cosmeticStore.ts` / admin cosmetics |
| Feedback ticket / reply **bodies** | User + admin prose |
| Optional restart announce `message` | Admin-supplied |
| Room display names players create | Rooms catalog shows author names |

### 5.3 Third-party chrome

| Surface | Notes |
|---------|-------|
| Nimiq Hub / Nimiq Pay SDK UI | Explicit map + brainstorm out of scope |
| Upstream wallet / mini-app system dialogs | Not owned by this repo |

### 5.4 Related deferrals / gray edges (inventory, not product locks)

| Surface | Why gray |
|---------|----------|
| Patch notes **markdown bodies** | English content pipeline today; planning defers; chrome still inventoriable |
| Terms/privacy **legal bodies** | Map open question; counsel review |
| `/analytics` allowlisted ops UI | Non-`/admin` path but not general players |
| Server System chat still English-on-wire | In inventory as player-visible; migration shape is later architecture |
| `roomPreview.html` | Thin preview status chrome; low priority / embed tool |
| Emote glyphs | Non-linguistic unless labels added |
| RTL | Explicitly out of v1 map |

---

## Cross-checks against docs

- **No i18n yet; locations of copy:** [docs/localization.md](../../../docs/localization.md).
- **Large client modules + SSR examples + out-of-scope authored/third-party/legal:** [docs/brainstorm/localization-implementation-plan.md](../../../docs/brainstorm/localization-implementation-plan.md).
- **Feature existence** (advertise, analytics allowlist, feedback, achievements hooks, stream overlay, rooms, tutorial, patch notes): [docs/features-checklist.md](../../../docs/features-checklist.md).
- **v1 product in/out:** [.scratch/localization/map.md](../map.md).

---

## Inventory verdict (gist)

v1 must treat as product string surfaces: **`client/src/ui/` player modules (esp. `hud.ts`)**, **`main.ts` rooms/status/error maps**, **achievements registry + panel labels**, **in-game feedback chrome**, **World Cup / invite / tutorial / wardrobe chrome**, **non-admin SSR** (`/payouts`, `/advertise`, guide; optionally `/analytics`), and **terms/privacy/patchnotes chrome** (legal/patchnote **bodies** still open or deferred). Explicitly out: **`/admin/*` + admin overlay**, **user/admin-authored text**, **Hub/Pay third-party UI**.
