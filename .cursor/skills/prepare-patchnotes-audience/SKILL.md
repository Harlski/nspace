---
name: prepare-patchnotes-audience
description: >-
  Finalizes Nimiq Space audience-facing patch notes under patchnote/versions/UNRELEASED/public
  (Brief, Players, Operators, Developers; optional 04-hotfix.md) before npm run prepare-merge freezes UNRELEASED.
  Alias PPA — use when the user says Use PPA, PPA, Prepare for merge, prepare-merge, audience
  patch notes, public patch tiers, or is about to freeze UNRELEASED; after prepare-merge, use
  only if public/*.md still need edits in the new semver folder.
---

# Prepare patch notes (audience) for merge

## When this runs (ordering)

1. **Primary — before `npm run prepare-merge`:** All work happens in **`patchnote/versions/UNRELEASED/public/`**. `prepare-merge` does **not** author or strip draft copy; it only renames the tree and bumps semver ([docs/THE-LARGER-SYSTEM.md](../../../docs/THE-LARGER-SYSTEM.md) *Release line*, [patchnote/README.md](../../../patchnote/README.md)).
2. **Secondary — after `prepare-merge`:** If something was missed, edit **`patchnote/versions/<new-semver>/public/*.md`** before shipping a client build.

Cursor does **not** auto-load skills from the npm script. The agent applies this skill when the user asks for merge prep (**PPA** / **Use PPA**) or when **AGENTS.md** points here before `prepare-merge`.

## Checklist (UNRELEASED)

Work from **`reasons.md`** (same `UNRELEASED` folder) as the source of facts; **`public/*.md`** is what `/patchnotes` ships.

- [ ] **`00-brief.md`** — 1–3 short sentences, plain language, no paths; remove `_(Draft — not published.)_` (or any template line) when real copy is ready.
- [ ] **`01-players.md`** — In-world / UX outcomes; same draft-line rule.
- [ ] **`02-operators.md`** — Deploy / env / Docker / migrations as needed; same draft-line rule.
- [ ] **`03-developers.md`** — API/WS / integrator summary; not a dump of `reasons.md`; same draft-line rule.
- [ ] **`04-hotfix.md`** *(only if present)* — Real hotfix narrative per [hotfix-release-notes](../hotfix-release-notes/SKILL.md); remove the file if this release is **not** a hotfix (see [docs/THE-LARGER-SYSTEM.md](../../../docs/THE-LARGER-SYSTEM.md) *Public patch notes*).
- [ ] Optional **`[NEW]` / `[FIX]` / …** list tags per [docs/patchnotes-release.md](../../../docs/patchnotes-release.md) for in-app badges.
- [ ] If a tier has **nothing** for that audience, say so explicitly (one honest line) instead of leaving only the draft placeholder.

## Then

From repo root: **`npm run prepare-merge`** (or **`--dry-run`** first). Review the diff, then commit and push per project norms.

## Optional: terminal reminder hook

To surface a **reminder after** `prepare-merge` completes in Cursor’s terminal, add a project **`afterShellExecution`** hook (see Cursor hook docs / create-hook skill). This repo does not ship a hook by default—skills and **AGENTS.md** carry the workflow.
