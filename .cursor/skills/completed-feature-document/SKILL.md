---
name: completed-feature-document
description: >-
  Nimiq Space incremental patch-note capture: writes or updates audience copy in
  patchnote/versions/UNRELEASED/public (00-brief through 03-developers; optional 04-hotfix.md) from the
  current task or completed work. Use when the user says Use completed-feature-document,
  CFD, completed feature document, or save patch notes / public patch notes from this work.
---

# Completed feature document (CFD) → `public/*.md`

## Purpose

During development, **`reasons.md`** and **`public/*.md`** do not update themselves. **CFD** is the cue to **persist** what just shipped (or was finished in-session) into the right **audience tier files** so nothing is lost before the next merge or handoff.

## Default target

- **`patchnote/versions/UNRELEASED/public/`** — unless the user names a specific frozen version (e.g. `0.3.6`), then use that folder’s **`public/*.md`** instead.

## What the agent does

1. **Infer scope** from the chat and recent edits: what behavior changed, for whom (players vs operators vs integrators).
2. **Read** [patchnote/versions/UNRELEASED/reasons.md](../../../patchnote/versions/UNRELEASED/reasons.md) (or the active version’s `reasons.md`) so new bullets **agree** with the technical log; **append** missing facts to `reasons.md` when they belong there (paths, WS message names, env vars, migrations)—not in **Brief**.
3. **Edit the tier files** (only those that need an update for this feature):
   - **`00-brief.md`** — Ultra-short outcome; no jargon or file paths ([docs/patchnotes-release.md](../../../docs/patchnotes-release.md)).
   - **`01-players.md`** — What players feel, can do, or see fixed.
   - **`02-operators.md`** — Deploy, Docker, env, breaking defaults.
   - **`03-developers.md`** — API/WS/modules touched; scannable bullets, not a full dump of `reasons.md`.
   - **`04-hotfix.md`** — Only when the user wants **hotfix / incident-shaped** copy; use **[`hotfix-release-notes`](../hotfix-release-notes/SKILL.md)** (**HRN**) instead of guessing.
4. **Formatting:** Prefer new **list lines**; optional tags **`[NEW]`**, **`[FIX]`**, **`[CHANGE]`**, **`[PERF]`**, **`[OPS]`**, **`[SEC]`** on bullets where they help `/patchnotes` badges.
5. **Draft placeholder:** When a file gains **real** audience copy, **remove** `_(Draft — not published.)_` (and similar template-only lines) from that file so `/patchnotes` does not show a fake draft line above real content.
6. **Dedupe:** Do not repeat the same line across tiers unless each wording serves a different audience; merge with existing bullets when obvious.

## After CFD (later)

For a full **pre-merge** polish (all tiers, placeholders), use **[`prepare-patchnotes-audience`](../prepare-patchnotes-audience/SKILL.md)** (**PPA** / **Use PPA**) before **`npm run prepare-merge`**.

## Triggers (examples)

- “**Use completed-feature-document**” / “**Use CFD**”
- “**CFD:** …” followed by what completed
- “Save this to patch notes / **public** files”

If the user gives **no** feature detail, ask one short clarifying question or infer from the open file / last diff before writing.
