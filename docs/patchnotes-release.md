# Patch notes & release copy — guide

Normative **workflow** and folder layout stay in [patchnote/README.md](../patchnote/README.md) and [THE-LARGER-SYSTEM.md](THE-LARGER-SYSTEM.md) (*Release line*). This document is the **editorial guide**: how each tier should read, what to emphasize, and how optional **change tags** render in the in-app **`/patchnotes`** feed.

---

## What “good” release notes optimize for

Public patch copy should answer **one question**: *what is different for me in this build?*

- **Outcome-first** — Describe **behavior in the product** (gates feel clearer, a crash is gone), not the internal debate or PR narrative.
- **Short** — Fewer words beat completeness. One crisp line beats a paragraph. If a reader needs detail, they move to a deeper tier (players → operators → developers) or `reasons.md`, not the other way around.
- **No process noise** — Avoid “we discussed”, “finally landed”, “refactor of”. Those belong in chat, not in `public/*.md`.
- **Ordered for scanning** — Within a tier, put the **highest-impact** items first. When using list tags (below), a useful default order is: **`[NEW]`** → **`[FIX]`** → **`[CHANGE]`** → **`[PERF]`** → **`[OPS]`** / **`[SEC]`** as applicable. Not every line needs a tag; use tags when the **kind** of change matters at a glance.

---

## Tier-by-tier intent

| File | Audience | Optimal shape | Voice |
|------|-----------|---------------|--------|
| **`00-brief.md`** | Widest reach (social, splash) | **1–3 short sentences** or a single tight paragraph. No bullets unless unavoidable. | Plain language; zero jargon; no file paths. |
| **`01-players.md`** | People who play | **Short bullets** grouped by theme if helpful. Focus on **feel, controls, fairness, visibility**. | “You can…”, “Fixed…”, still no paths or module names unless it’s a renamed control players see. |
| **`02-operators.md`** | Self-hosters, deploy | **Bullets**: env vars, migrations, Docker/compose, breaking config, defaults. Link to longer ops docs if needed. | Precise names; say **what to do** (set X, bump image). |
| **`03-developers.md`** | Integrators / contributors | **Summary** of API/WS surface or extension points touched—not a dump of `reasons.md`. | Technical but still **scannable**; point to code paths when it saves a paragraph. |

**`reasons.md`** (same version folder) remains the **technical inventory** for that release: paths, messages, migrations. It does **not** ship in `/patchnotes`; it complements `public/*.md` for people who need to reconstruct the change set.

### When a build is mostly ops / dev (nothing meaningful for players)

`prepare-merge` does **not** auto-fill `public/*.md`. If you freeze while **`00-brief.md`** / **`01-players.md`** still only show the draft placeholder, `/patchnotes` will look empty for those tiers even when **`reasons.md`** is full—so either fill them **before** freeze or **edit the frozen version folder** before you publish.

If this release really has **no** outcome worth a casual or in-world reader’s time (infra-only, contributor-only), say so **explicitly** in those files instead of leaving them blank. That still answers “what is different for me?”—honestly—with one scan.

**Brief (`00-brief.md`)** — one or two short sentences, plain language, no jargon:

```markdown
No changes to gameplay or controls in this build. This update is for people who run or deploy the server (safer restarts and backups) and for developers maintaining the codebase.
```

**Players (`01-players.md`)** — a single bullet or short paragraph is enough:

```markdown
- Nothing new to try in the world for this release—under the hood we improved how deployments run and how the app is built. You can skip this one unless an operator asked you to update.
```

Use **`[OPS]`** on operator lines when you also mention deploy behavior there; avoid **`[NEW]`** / **`[FIX]`** in the players tier unless something in the product actually changed for players.

---

## Optional change tags (in-app badges)

In **`public/*.md`**, you may prefix **list items** (and optionally a whole **paragraph**) with a bracket tag so `/patchnotes` can show a small label:

```markdown
- [NEW] Wallet rooms: owners can set where new visitors land.
- [FIX] No longer stuck on a gate tile after it closes.
- [CHANGE] Gate tool shows clearer walk hints while placing.
- [PERF] Faster room list when many wallet rooms exist.
- [OPS] New env var `EXAMPLE` (default off).
- [SEC] Session cookie hardened (operators only if relevant).
```

**Rules**

- Tag is **`[UPPERCASE]`** immediately after `- `, then **one space**, then the rest of the line: `- [FIX] …`
- Only these codes are recognized (unknown `[FOO]` stays literal text):
  - **`[NEW]`** — new capability or materially new UX.
  - **`[FIX]`** — bug fix or regression repair.
  - **`[CHANGE]`** — intentional behavior or UX change that is not a bug fix.
  - **`[PERF]`** — performance or latency.
  - **`[OPS]`** — deploy, env, migrations, ops runbooks (common in `02-operators.md`).
  - **`[SEC]`** — security-relevant change (use sparingly; be accurate).

**`Audience:` / `Depth:`** hint lines are still supported in source; the client strips them for display (see [client/src/patchnotes/mdToHtml.ts](../client/src/patchnotes/mdToHtml.ts)).

---

## Checklist before freeze (`prepare-merge`)

- [ ] **Brief** reads well as the **only** thing a casual reader sees.
- [ ] **Players** bullets are **true in production** and ordered by impact.
- [ ] **Operators** mentions anything that breaks or upgrades a deployment.
- [ ] **Developers** flags anything an integrator must **react** to (API, WS, auth).
- [ ] Tags are **honest** (a `[FIX]` is user-visible wrongness repaired, not a refactor).

---

## See also

- [patchnote/README.md](../patchnote/README.md) — directory layout, `prepare-merge`, `UNRELEASED` workflow.
- [THE-LARGER-SYSTEM.md](THE-LARGER-SYSTEM.md) — release line principle and patch-notes norm.
- [MEMORY.md](../MEMORY.md) — anchor to this guide and the larger system.
