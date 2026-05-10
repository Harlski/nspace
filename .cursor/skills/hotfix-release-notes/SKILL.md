---
name: hotfix-release-notes
description: >-
  Nimiq Space hotfix narrative for /patchnotes: fills patchnote/versions/<version>/public/04-hotfix.md
  (separate from Brief → Developers). Use when the user says hotfix release notes, hotfix notes,
  HRN, Use hotfix release notes, or is shipping an urgent corrective release and needs “what broke /
  what we patched / why now” copy.
---

# Hotfix release notes → `public/04-hotfix.md`

## What this is

**Hotfix** is a **fifth tier** in `/patchnotes`, labeled **Hotfix** next to Brief / Players / Operators / Developers. It is an **optional** markdown file: **`patchnote/versions/<version>/public/04-hotfix.md`**.

- **Normal patch notes** (Brief → Developers) stay the primary **“what changed in this semver”** story for most readers.
- **Hotfix** is the dedicated place for **urgent corrective releases**: symptoms users or ops saw, **what** was patched, **why** it could not wait for the next routine release, and any **residual risk** or **follow-up** in one short page.

Do **not** duplicate the full `reasons.md` inventory here—link mentally to **`reasons.md`** for file-level detail; keep Hotfix **scannable** for humans under pressure.

## When to use

- Production or user-visible **breakage**, **security**, or **data-loss** class issues fixed **out of band** from the usual feature train.
- When stakeholders need a clear **“this was a hotfix”** narrative without rewriting Brief/Players tiers into war stories.

**`npm run prepare-merge` does not create `04-hotfix.md`.** Add it only when a version needs a hotfix narrative. When there is **no** hotfix story, do not add the file. The client **bundles non-empty** tiers only, so missing file = no Hotfix row for that version.

## Target path

- **`patchnote/versions/UNRELEASED/public/04-hotfix.md`** while developing; or **`patchnote/versions/<semver>/public/04-hotfix.md`** after freeze if you are amending a frozen tree before publish or cherry-picking copy.

## Editorial shape (suggested)

Use short bullets or 2–4 tight paragraphs:

1. **What was wrong** — observable symptom (player, operator, or integrator), no long postmortem.
2. **What we changed** — high-level fix; optional **`[FIX]`** / **`[SEC]`** / **`[OPS]`** tags on bullets if they help `/patchnotes` badges.
3. **Why now** — one or two lines: severity, blast radius, or blocking nature.
4. **Optional** — “Still investigating…”, known follow-ups, or “no further client action” for ops.

Remove **`_(Draft — …)_`** when the copy is real (see [docs/patchnotes-release.md](../../../docs/patchnotes-release.md)).

## Relationship to other workflows

- **`reasons.md`** — still the technical inventory for the same version; append paths, env vars, WS messages there.
- **CFD** ([`completed-feature-document`](../completed-feature-document/SKILL.md)) — usually updates Brief → Developers; add or refresh **Hotfix** when the user explicitly wants hotfix narrative.
- **PPA** ([`prepare-patchnotes-audience`](../prepare-patchnotes-audience/SKILL.md)) — before `npm run prepare-merge`, if this version is hotfix-driven, ensure **`04-hotfix.md`** is honest and not a draft placeholder; otherwise remove the file for that release.

## Normative pointers

- [docs/THE-LARGER-SYSTEM.md](../../../docs/THE-LARGER-SYSTEM.md) — *Public patch notes* and *Hotfix release notes*.
- [patchnote/README.md](../../../patchnote/README.md) — folder layout including **`04-hotfix.md`**.
