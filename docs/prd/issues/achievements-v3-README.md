# Achievements v3 — issue slices

Vertical-slice breakdown of [../achievements-v3-exploration-building-meta.md](../achievements-v3-exploration-building-meta.md).

Implement each in a **fresh context**, in dependency order:

| # | Slice | Blocked by | Status |
|---|-------|------------|--------|
| 0 | [Engine + Marathon I tracer](achievements-v3-0-engine.md) | [v2 engine](achievements-v2-0-engine.md) | done |
| 1 | [Exploration tourism & transit](achievements-v3-1-exploration.md) | 0 | done |
| 2 | [Worldcraft](achievements-v3-2-worldcraft.md) | 0 | done |
| 3 | [Mining + Pixel extensions](achievements-v3-3-mining-pixel.md) | 0 | done |
| 4 | [World Cup match + field extensions](achievements-v3-4-wc-extensions.md) | 0, [v2 match hooks](achievements-v2-1-match-hooks.md), [v2 field/social](achievements-v2-2-field-social.md) | done |
| 5 | [Play Space, social & meta](achievements-v3-5-social-meta.md) | 0 | in progress |

**Next:** [achievements-v3-5-social-meta](achievements-v3-5-social-meta.md)

**Prerequisite:** v2 foundation (engine + WC hooks + banner) is **done on branch** — see [achievements-v2-README.md](achievements-v2-README.md). Slice v3-4 still depends on those hooks existing at merge time.

**Testing seam:** Achievement Store public API + pure exploration / match evaluators (see PRD).

**GitHub:** [#15](https://github.com/Harlski/nspace/issues/15) — PRD umbrella only. Slice issues are **local markdown** (`achievements-v3-*.md` here), not published as separate GitHub issues.
