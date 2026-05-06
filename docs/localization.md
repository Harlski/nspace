# Localization (i18n)

**Status:** There is **no** i18n framework wired up yet. All player-visible copy in the game client lives in TypeScript/HTML under `client/src/ui/` (and related). Server-rendered HTML pages build strings in TypeScript (`server/src/analyticsPublicPage.ts`, `server/src/analyticsAdminPage.ts`, `server/src/pendingPayoutsPublicPage.ts`, etc.). `client/index.html` uses `lang="en"` only.

**If you implement multiple languages:** use [brainstorm/localization-implementation-plan.md](brainstorm/localization-implementation-plan.md) for tooling and workflow ideas (that file is non-normative until a stack is chosen).

**Related (implemented layout rules):** [ui-styling.md](ui-styling.md), [process.md](process.md).
