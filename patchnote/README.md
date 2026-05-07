# Patch notes

Nimiq Space does not yet ship a single canonical **public patch feed**. This tree still supports **version-scoped** work: every patch-notes **version** gets attached **technical reasons** and optional **public summaries** at several explanation depths and for different interests.

## Layout

Each patch-notes version is a directory:

```text
patchnote/versions/<version>/
  reasons.md          ← technical inventory for *this* version (always attached to the same folder)
  public/
    00-brief.md       ← shortest; widest audience
    01-players.md     ← players / non-technical
    02-operators.md   ← self-hosters, deploy, env, migrations
    03-developers.md  ← integrators / contributors (summary, not full reasons)
```

- **`<version>`** should match the **root** `package.json` semver after a normal merge freeze (see **`npm run prepare-merge`**). Other unique labels (calendar tag `2026.05.06`, `deploy-*`) remain possible for exceptional releases if ever needed.
- **`reasons.md`** is the low-level **why / what changed** log for **that** patch-notes version only. Do not mix versions in one file.
- **`public/*.md`** are the **summarized public patch notes** you can publish (or paste into blog / Discord / release UI) at the depth that matches the reader. They may stay empty until you are ready to ship copy.

## Workflow

| Phase | What to do |
|-------|------------|
| **Between commits** | Append to **`versions/UNRELEASED/reasons.md`**. When you have something to say to a given audience, fill or adjust the matching **`versions/UNRELEASED/public/*.md`**. |
| **Prepare to merge to `main`** | From repo root, run **`npm run prepare-merge`** (patch bump by default; **`--minor`** or **`--major`** when appropriate). That renames **`UNRELEASED`** → **`<next semver>`**, bumps root **`package.json` `version`**, normalizes `UNRELEASED` markers inside the frozen markdown, and seeds a fresh **`UNRELEASED/`** tree. Use **`npm run prepare-merge -- --dry-run`** to print the planned bump without changing files. Then review, **`git add`**, **`git commit`**, **`git push`**. |
| **Freeze without the script** | Only if needed: manually rename **`versions/UNRELEASED/`** → **`versions/<version>/`**, bump root **`package.json`** to the same `<version>`, and recreate **`versions/UNRELEASED/`** with empty `reasons.md` and reset `public/*.md` (match structure from the last frozen version). |

Legacy path **`reasons_UNRELEASED.md`** at the root of `patchnote/` is a **stub** that points at `versions/UNRELEASED/reasons.md`.

## What to write in `reasons.md`

- Concrete paths, packages, routes, env vars, WebSocket message names, Docker services — enough to reconstruct the change set for **this** version.
- Not marketing copy; optional one-line user impact is fine.

## What to write in `public/*.md`

- **Audience-specific** summaries so you can submit the same release as **brief**, **player**, **operator**, or **developer** patch notes without duplicating the full reasons file.

See also [MEMORY.md](../MEMORY.md), [AGENTS.md](../AGENTS.md), and [docs/THE-LARGER-SYSTEM.md](../docs/THE-LARGER-SYSTEM.md) (release gate before merge to `main`).
