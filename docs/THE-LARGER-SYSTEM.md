# The larger system — Nimiq Space

This document collects **design principles** and **important design decisions** for Nimiq Space (`nspace`). It is intentionally allowed to be **incomplete**: the goal is to record what matters for a coherent, evolvable product and codebase, and to refine it over time.

**How to use it**

- Before substantial design or implementation work, **read this file** and check whether existing principles apply or conflict.
- When you make or confirm a cross-cutting decision (world model, sync, extensibility, UX philosophy, monetization boundaries, etc.), **update this document** with a short, durable note rather than relying only on chat or one-off PR descriptions.
- **Whenever you intentionally change this file** (add, remove, or materially reword principles or recorded decisions), you **must** also create a new companion file at **`docs/reasons/reason_{unique_6digit_id}.md`** (six digits, unique among existing `docs/reasons/reason_*.md` names). That file should explain **why** `THE-LARGER-SYSTEM` was updated and **how** the change better supports the goals of the larger system (coherence, evolvability, and clear direction). Typos and formatting-only fixes do not require a reason file.

**Relationship to other docs**

- [features-checklist.md](features-checklist.md) and implementation docs describe **current behavior**.
- [brainstorm/README.md](brainstorm/README.md) holds **non-normative** exploration; do not treat it as product truth.
- **This file** sits in between: it is **normative for direction and principles** where we have agreed them, without replacing detailed specs.

---

## Principles (living)

_Add sections here as the system matures. Keep each bullet concrete enough that a future implementer knows what “good” looks like._

- Prefer designs that **scale from simple to rich** without rewriting core contracts (e.g. identifiers, message shapes, room authority) unless there is a deliberate migration story.

- **Player-adjacent durable state** — For account-scoped data that will **grow**, be **queried**, or need **consistent updates**, default to a **bounded persistence layer** (shared DB or equivalent) with explicit migrations — not a new whole-file JSON store for every feature. JSON-on-disk remains acceptable for small, cold, or transitional data; see **Player-adjacent persistence** under *Recorded decisions*.

- **Client-only visuals on authoritative world objects** — Sparkles, auras, and similar **non-gameplay** overlays on server-owned geometry (e.g. placed obstacles) stay **client render only**: they do not change server state. They must **not** participate in block ray picks or build-mode selection **bounds** unless they are intentionally part of the solid body. Mark decorative children explicitly (e.g. `userData.skipBlockPickAndBounds` in [client/src/game/Game.ts](../client/src/game/Game.ts)) and derive selection outlines from solid `THREE.Mesh` descendants only (`blockGroupWorldBoundsForSelectionOutline`).

- **In-world UI copy stays idiomatic** — Context actions, tool labels, and short prompts should read like **controls** (a few words), not tutorials. Prefer **one clear verb phrase** per menu row; put explanations in docs, patch notes, or optional help surfaces—not stacked lines on every right-click. Unauthorized or irrelevant actions belong as **no menu**, a disabled control, or a terse system line—not a paragraph in the menu.

- **Objects vs Room (authoring UI)** — Treat **placeable world content** (blocks, props, billboards, teleporters, etc.) under an **Objects** affordance. Treat **room-level configuration** that is not a placed obstacle—**ambient presentation** (e.g. background hue), **topology affordances** (extra floor where supported), **guest entry spawn**, and similar—under a **Room** affordance. Keep new features on the matching side so players and implementers share one mental model and we avoid overloading the object tool list with room settings. In the **client HUD**, keep the **Objects / Room scope control** next to the **Terrain / Props / Buildings** dock tabs (one row, scope on the **right** when both per-room caps apply)—not a second disconnected “edit menu” beside **Build** that duplicates the same choice.

- **Reposition ghost previews (authoring)** — When the player is **moving** or **repositioning** a placeable obstacle in build/edit flows, the client should show a **semi-transparent preview (“ghost”)** at a **valid** hover destination so intent is obvious before commit. That preview is **client-only** and must **not** be treated as authoritative world state until the server accepts the move. Prefer **one visual language** across object kinds: block-shaped props use the same translucent material path as **new-block placement preview** (`makeBlockMesh` with `ghost: true` on the client); gates and billboards may add their own cues (e.g. exit/front floor tints, footprint highlights, billboard-specific ghost mesh) on top. **New** reposition or drag-to-move flows should ship **with** an appropriate ghost or equivalent footprint preview in the same change, not as a follow-up polish item.

---

## Recorded decisions & forward constraints

### Tiles: per-cell customization (future)

**Today:** walkable floor cells support **per-tile solid color** (`colorRgb`) on both **extra** floor and **core/base** grid tiles—authored from **Room → Floor** in the build dock (same hue ring as blocks), persisted server-side, and rendered client-side as instanced lit top quads. Default core/extra palette tones remain when no override is stored. See [build_menu.md](build_menu.md) and [features-checklist.md](features-checklist.md).

**Direction:** extend beyond **flat color** to arbitrary per-cell content (meshes, materials, decals, props). When we implement that, favor:

- A clear split between **tile data** (what a cell *is*) and **rendering** (meshes, materials, decals, props).
- A path for **persistence and authority** if tile state is shared or player-owned (server as source of truth where gameplay or fairness matters).

Update this subsection when the data model or sync story is chosen.

### Player-adjacent persistence: beyond one-off JSON files

**Today:** several features persist **per-wallet or global** data as **JSON documents on disk** (e.g. profiles, moderation flags, optional streaks / admin banner settings, allowlists). That is fine for **early scale** and simple ops (copy a file, inspect in an editor).

**Risk as the product grows:** each new `{thing}.json` tends to imply **full-file read / parse / rewrite** on change, weak **concurrency** story under parallel requests, ad hoc **schema evolution**, and **N unrelated silos** that are hard to query, migrate, or reason about together. Player-facing features that accumulate history (streaks, cosmetics, entitlements) especially deserve a **clear home**, not an endless sprawl of flat files.

**Direction (for future design — migrate gradually):**

- Prefer **one bounded persistence layer** for “player-adjacent” state over time — e.g. a **single-process embedded DB** (SQLite is already a precedent in this repo for the payment-intent sidecar) or a **small set of well-named tables/services**, not a new root-level JSON store for every feature by default.
- Treat **normalized wallet id** (or another stable account key) as the **primary key** where the data is account-scoped; keep **migrations and versioning** explicit when the shape changes.
- When adding a feature, ask: **does this need transactional updates, indexed queries, or growth in row count?** If yes, **wire it against the shared persistence path** (or introduce one) rather than bolting on another whole-file JSON lifecycle.
- **Migration** can be incremental: backfill from existing JSON into tables, run dual-write or read-fallback during a transition, then retire the file. Old files can remain as **export / disaster-recovery** snapshots if useful, but should not be the long-term source of truth for hot paths.

Update this subsection when the first consolidated store is chosen and named in implementation docs.

### Public HUD messaging (header marquee)

**Today:** The in-game **header marquee** combines an optional **login-streak leaderboard** ticker with rotating **`newsMessages[]`** when admins enable it. The **server** is the source of truth for **visibility**, **copy**, **leaderboard rows** (including label disambiguation and wallet dedupe), **`marqueeMessageSeconds`** dwell, and a clamped **`marqueeStreakSeconds`** safety window if the client never observes a horizontal loop end. The **client** owns **layout and motion**: a duplicated horizontal strip, CSS **`animationiteration`** to advance streak → message rotation in sync with **one full seamless loop**, **`ResizeObserver`** and image **load/error** hooks to remeasure when identicons decode, and—when natural text width is **shorter than the ticker viewport**—per-chunk invisible padding so **one loop still traverses at least the visible width** on large screens without breaking the duplicate seam.

**Direction:** Keep the public **`GET /api/header-marquee`** payload JSON-safe and bounded; do not move scroll timing to the server unless there is a deliberate product reason (e.g. synchronized broadcast across clients). If copy or rows grow substantially later, prefer explicit limits, truncation, or composition rules over ad hoc growth in the hot response.

Update this subsection if the API shape, authority split, or rotation contract changes.

### Authoring UX: reposition ghost previews

**Norm:** See the principle **Reposition ghost previews (authoring)** above: valid-hover **ghost** before commit; **server** remains source of truth for placed obstacles until a move succeeds.

**Concrete paths today (client):** **New-block placement** uses a translucent block mesh at the hover stack slot. **Gate** reposition adds a gate-shaped ghost, exit/front **floor tints**, and optionally **freezes** the source mesh’s rendered opening until the move ends. **Billboard** reposition uses **footprint tile highlights** plus a **translucent billboard** proxy. **Other obstacles** (shapes rendered via `makeBlockMesh`) use the same ghost material path at the hover tile when move targets are valid.

**Forward constraint:** Adding a new placeable type with a reposition or drag-to-move interaction should include its ghost (or an equivalent clear preview), reusing shared helpers where possible.

Update this subsection if preview ownership, materials, or which interactions require a ghost changes materially.

### Authoring HUD: bottom build dock (compact placement)

**Today:** Build mode uses a **compact bottom-right strip** (primarily the **Build** toggle; top toolbar holds **Feedback** and other global actions per [docs/features-checklist.md](features-checklist.md)) plus a **bottom build dock** (dark glass chrome): **Terrain / Props / Buildings** category tabs, tool cards (optional **cached PNG thumbnails** from a shared off-DOM WebGL bake in [client/src/game/Game.ts](../client/src/game/Game.ts)), a **two-column context** strip (modifiers + **hue ring** sized to the column), and **live GL previews** for placement/selection docked in the tools column **across** dock tabs. **Objects vs Room** (when the room allows both block placement and room/floor editing) is chosen from the **right of the dock tab row**—**`<select>` on desktop**; on **coarse-pointer mobile** a **button + fixed overlay list** replaces the native device picker. **Room** scope uses **Floor** / **Room settings** tabs (not Terrain/Props/Buildings); **room background hue** (swatch + popover wheel) lives in the **context column** on **Room settings**, not in the tool strip. **Closing build** (e.g. dock **×**) or **opening build again** resets scope to **Objects** and the **Floor** room tab when both caps apply, so authors do not re-enter a stale **Room settings** layout.

**Block and gate color:** Authoring uses **`colorRgb`** on the wire (legacy **`colorId`** migrated at server load). The shared **hue ring** ([paletteHueRing.ts](../client/src/ui/paletteHueRing.ts)) covers **next placement**, **selected tile edit**, **room sky**, and **floor tiles** (Room scope → **Floor** tab: hover preview, left-click place/recolor—including under blocks—right-click remove extra floor on desktop); **click the ring center** for a custom **#RRGGBB** popover ([paletteHueHexPopover.ts](../client/src/ui/paletteHueHexPopover.ts)). Hex prisms and spheres expose **thickness** / **size** steppers in the dock context column (`hexRadiusScale`, `sphereRadiusScale`). Plain **cubes** expose **Rot X/Y/Z** steppers (90° steps; visual only).

**Live preview in the dock:** Partial or in-progress edits (hex typing, hue drag preview) should update **local HUD chrome + client preview meshes** without running a full **`syncBuildHud`** on every tick. **Commit** paths persist: placement → `onBuildPlacementStyle` / `Game.setPlacementBlockStyle`; selection → `emitPanelProps`; room sky → room-bg pick handlers. Refreshing the bar from game state uses **UI-only** sync (`syncPlacementColorRgbUi`) so `setBuildBlockBarState` does not re-enter the placement handler loop.

**Norm:** One **primary** surface for placement density (the dock); avoid parallel stacks of tutorial copy on every tool—brief labels on controls, longer explanation in docs and patch notes (see **In-world UI copy stays idiomatic** and **Public patch notes** elsewhere in this file). Component names: [build_menu.md](build_menu.md).

**Forward constraint:** New build-time tools should **hook the same dock contract** (category, thumbnails if card-based, context column, preview host) unless there is an explicit UX reason to split another surface. New **room-level** settings belong in **Room** scope (context column or Room tabs), not the object category tabs. New **color** affordances should reuse the **hue ring + hex popover** pair unless there is a deliberate separate UX.

Update this subsection when dock tabs, preview ownership, Objects/Room placement, or scope-reset behavior changes materially.

### Release line: patch notes + semver on merge

**Intent:** One clear moment ties **shipping semver** (root `package.json`) to **frozen patch notes**, so `main` always carries a coherent “what we just released” **folder and version labels** without hand-renaming drift.

**What “hands off” means here (today):** **`npm run prepare-merge`** automates the **mechanical release line** only—semver bump, renaming `UNRELEASED` → `<next-semver>`, rewriting **structural** `UNRELEASED` references in the frozen markdown (paths, titles), and seeding the **next** `UNRELEASED/` tree. You should not hand-rename version folders or bump `package.json` separately from that freeze.

**What is *not* automated (today):** The script does **not** write or rewrite **audience copy** in `public/*.md`, does **not** remove template lines such as “draft / not published” placeholders, and does **not** pull summaries from `reasons.md` into the public tiers. **Player-, operator-, and developer-facing prose** is still **authored deliberately** under `UNRELEASED` (or edited in the frozen `versions/<semver>/` folder before you ship a client build). Treat “ready to merge” as: **technical + public copy are already what you want frozen**, then run `prepare-merge` so the tree and semver stay honest.

**Human / agent cue:** **“Prepare for merge”** (to `main`) means: run **`npm run prepare-merge`** first (default **patch** bump; use `--minor` or `--major` when the change set warrants it). That command:

1. Renames `patchnote/versions/UNRELEASED/` → `patchnote/versions/<next-semver>/` and rewrites `UNRELEASED` markers inside those markdown files to that version (structure and labels, not editorial pass on body copy).
2. Bumps the **root** `package.json` `version` to the same `<next-semver>`.
3. Creates a fresh `patchnote/versions/UNRELEASED/` with empty starter `reasons.md` and `public/*.md` templates for the next cycle.

After that, the author **reviews diffs**, then **`git add`**, **`git commit`**, **`git push origin main`**. The version is **already in the commit**; there is no separate post-push versioning step unless you add release tagging in CI later.

**Norm:** Do not merge accumulated `UNRELEASED` work to `main` without running `prepare-merge` (or an equivalent manual freeze that keeps folder name and `package.json` in lockstep). Agents assisting with merges should run or insist on this script when the user says they are ready to merge.

### Public patch notes (voice, outline, in-app)

**Intent:** `patchnote/versions/<semver>/public/*.md` is **player- and operator-facing truth** for “what changed in the product,” not a transcript of design discussion. Prefer **few words**, **observable outcomes**, and **impact order**: lead with **new capabilities** (`[NEW]` in lists where tagged), then **fixes** (`[FIX]`), then **intentional behavior changes** (`[CHANGE]`), then **performance** (`[PERF]`), then **deploy/ops** (`[OPS]`) or **security** (`[SEC]`) when relevant. The same ordering helps scanning in Discord or blog paste-outs.

**Relationship to automation:** Filling and cleaning `public/*.md` is **editorial work before merge** (or a follow-up edit on the frozen folder before publishing a build). It is **outside** what `prepare-merge` automates; see **Release line: patch notes + semver on merge** above.

**Tiers (short):** **Brief** — ultra-short, no jargon. **Players** — what you feel or can do in-world. **Operators** — env, Docker, migrations, breaking defaults. **Developers** — integrator-facing deltas (API/WS), still scannable; deep file paths and message inventories stay in **`reasons.md`** for that version. **Hotfix** — optional fifth tier (`public/04-hotfix.md`): urgent corrective narrative (what was wrong, what was patched, why now); **separate** from the normal Brief → Developers story so routine notes stay outcome-focused while hotfixes still get an honest incident-shaped summary. Omit the file for versions that are not hotfix-driven (`npm run prepare-merge` does not create it).

**Hotfix release notes (workflow):** Treat **Hotfix** as a small **form** for pressure releases, not a second copy of `reasons.md`. Authors add **`patchnote/versions/<version>/public/04-hotfix.md`** only when needed; follow **[`.cursor/skills/hotfix-release-notes/SKILL.md`](../.cursor/skills/hotfix-release-notes/SKILL.md)** when drafting (**HRN** / **Use hotfix release notes**). Pre-merge audience polish (**PPA**) should drop or fill this file so frozen trees do not ship placeholder-only Hotfix copy.

**Authoring guide:** [patchnotes-release.md](patchnotes-release.md) — tier-by-tier shape, tag legend, pre-freeze checklist. [MEMORY.md](../MEMORY.md) points here so agents and humans share one outline.

**In-app:** `/patchnotes` bundles frozen semver `public/*.md` at client build time; optional list (and leading-paragraph) tags **`[NEW]`**, **`[FIX]`**, **`[CHANGE]`**, **`[PERF]`**, **`[OPS]`**, **`[SEC]`** render as compact badges (see [client/src/patchnotes/mdToHtml.ts](../client/src/patchnotes/mdToHtml.ts)). The audience dropdown includes **Hotfix** when that version’s `04-hotfix.md` exists and is non-empty.

### Production VPS deploy: stop, backup `data/`, then upgrade

**Today:** The [GitHub Actions deploy workflow](../.github/workflows/deploy-docker.yml) (documented in [deploy-github-docker.md](deploy-github-docker.md)) **stops** the Compose project first (`docker compose stop`) so the `nspace` container receives **SIGTERM** and the server’s shutdown path sync-flushes world state, event logs, and related on-disk stores. It then writes a **gzip tarball** of the host **`data/`** tree (the bind mount for live persistence, including optional `data/payment-intent/` when that sidecar is used) under **`backups/nspace-data-<UTC-timestamp>.tar.gz`** beside the clone, then fast-forwards git and runs **`docker compose build`** / **`up -d`**.

**Operator expectation:** Archives are **not** pruned automatically—plan disk retention (delete old tarballs or copy them off-box). Restoring from a tarball is unpack-and-replace `data/` with containers stopped, then start again.

Update this subsection if the workflow name, paths, or backup format change.

---

## Changelog (optional)

_Use brief dated entries if you want a paper trail without bloating the sections above._

- **2026-05-06** — Initial document: `MEMORY.md` anchor, tile customization forward constraint.
- **2026-05-06** — Mandatory companion rationale for intentional edits; see [reasons/reason_618503.md](reasons/reason_618503.md).
- **2026-05-07** — Principle: client-only decorative overlays on obstacles; picking/selection use solid mesh bounds only. See [reasons/reason_834162.md](reasons/reason_834162.md).
- **2026-05-07** — Release line: `prepare-merge` freezes `UNRELEASED` patch notes and bumps root semver before merge to `main`. See [reasons/reason_291847.md](reasons/reason_291847.md).
- **2026-05-07** — Companion rationales moved to **`docs/reasons/`** (see [reasons/reason_105892.md](reasons/reason_105892.md)).
- **2026-05-07** — Player-adjacent persistence: prefer a bounded DB (or similar) over proliferating JSON files; migrate incrementally. See [reasons/reason_472039.md](reasons/reason_472039.md).
- **2026-05-07** — Recorded decision: header marquee — server owns payload and timing bounds; client owns ticker layout, seamless scroll, and viewport-wide loop distance. See [reasons/reason_770142.md](reasons/reason_770142.md).
- **2026-05-08** — Principle: in-world UI (context menus, short prompts) stays idiomatic—brief labels, no tutorial paragraphs on every interaction. See [reasons/reason_503821.md](reasons/reason_503821.md).
- **2026-05-08** — Principle: authoring UI separates **Objects** (placeable content) from **Room** (room-level settings such as background and guest spawn). See [reasons/reason_640281.md](reasons/reason_640281.md).
- **2026-05-09** — Principle + recorded UX: **reposition ghost previews** for placeable obstacles (client-only hover visualization; gates / billboards / generic blocks). See [reasons/reason_927415.md](reasons/reason_927415.md).
- **2026-05-09** — Public patch notes norm + editorial guide ([patchnotes-release.md](patchnotes-release.md)); optional in-app change tags. See [reasons/reason_673942.md](reasons/reason_673942.md).
- **2026-05-09** — Recorded decision: GitHub Actions VPS deploy stops the stack, tarballs host `data/` under `backups/`, then rebuilds. See [reasons/reason_458291.md](reasons/reason_458291.md).
- **2026-05-10** — Release line: clarify **automated** (semver + folder freeze) vs **not automated** (`public/*.md` copy, draft placeholders). See [reasons/reason_551903.md](reasons/reason_551903.md).
- **2026-05-10** — Optional **`/patchnotes` Hotfix** tier (`public/04-hotfix.md`) + agent skill for hotfix narratives (separate from Brief → Developers). See [reasons/reason_384729.md](reasons/reason_384729.md).
- **2026-05-14** — Authoring HUD: bottom build dock contract + Objects/Room scope aligned to dock tab row (principle tweak). See [reasons/reason_906712.md](reasons/reason_906712.md).
- **2026-05-19** — Build dock: Room settings in context column, mobile scope overlay, reset to Objects on close/reopen. See [reasons/reason_917384.md](reasons/reason_917384.md).
- **2026-05-21** — Build dock: `colorRgb`, shared hex popover, live preview without per-keystroke `syncBuildHud`. See [reasons/reason_284651.md](reasons/reason_284651.md).
- **2026-05-24** — Per-tile floor `colorRgb` (Room → Floor hue ring); cube rotation steppers; tiles “today” note. See [reasons/reason_392847.md](reasons/reason_392847.md).
