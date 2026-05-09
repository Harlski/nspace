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

- **Objects vs Room (authoring UI)** — Treat **placeable world content** (blocks, props, billboards, teleporters, etc.) under an **Objects** affordance. Treat **room-level configuration** that is not a placed obstacle—**ambient presentation** (e.g. background hue), **topology affordances** (extra floor where supported), **guest entry spawn**, and similar—under a **Room** affordance. Keep new features on the matching side so players and implementers share one mental model and we avoid overloading the object tool list with room settings.

---

## Recorded decisions & forward constraints

### Tiles: per-cell customization (future)

**Today:** floor presentation is largely limited to **color** (and the current tile mesh assumptions documented in [tile.md](tile.md)).

**Direction:** we want to be able to **customize individual tiles** with arbitrary content over time—not only a solid floor color. Nothing is required for this yet; when we implement it, favor:

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

### Release line: patch notes + semver on merge

**Intent:** One clear moment ties **shipping semver** (root `package.json`) to **frozen patch notes**, so `main` always carries a coherent “what we just released” folder without hand-renaming drift.

**Human / agent cue:** **“Prepare for merge”** (to `main`) means: run **`npm run prepare-merge`** first (default **patch** bump; use `--minor` or `--major` when the change set warrants it). That command:

1. Renames `patchnote/versions/UNRELEASED/` → `patchnote/versions/<next-semver>/` and rewrites `UNRELEASED` markers inside those markdown files to that version.
2. Bumps the **root** `package.json` `version` to the same `<next-semver>`.
3. Creates a fresh `patchnote/versions/UNRELEASED/` with empty starter `reasons.md` and `public/*.md` templates for the next cycle.

After that, the author **reviews diffs**, then **`git add`**, **`git commit`**, **`git push origin main`**. The version is **already in the commit**; there is no separate post-push versioning step unless you add release tagging in CI later.

**Norm:** Do not merge accumulated `UNRELEASED` work to `main` without running `prepare-merge` (or an equivalent manual freeze that keeps folder name and `package.json` in lockstep). Agents assisting with merges should run or insist on this script when the user says they are ready to merge.

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
