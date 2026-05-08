# Public patch notes — developers (`0.3.2`)

**Audience:** contributors and integrators — APIs, WS messages, module boundaries, notable refactors.  
**Depth:** summarized technical changelog; not a full file list (that stays in [../reasons.md](../reasons.md)).

---

- **`GET /api/header-marquee`** — Public JSON: `visible`, `leaderboard` rows (wallet id, display label, streak days, identicon URL), `newsMessages`, `marqueeStreakSeconds`, `marqueeMessageSeconds`. Server clamps streak fallback (e.g. bounded band) and sanitizes message lines; leaderboard labels are deduped/disambiguated server-side.
- **Client marquee** — [client/src/ui/headerMarquee.ts](../../../../client/src/ui/headerMarquee.ts): polls the endpoint; streak view uses a **duplicated DOM chunk** and CSS animation **`translateX(0)` → `translateX(-50%)`** so one iteration equals one logical copy. **`animationiteration`** advances to the next **news** line when both are enabled; **`marqueeStreakSeconds`** arms a one-shot fallback if iteration never fires. **`ResizeObserver`** (ticker wrap + track) and image **load/error** handlers resync duration after layout changes (e.g. identicons). **Per-chunk invisible flex fill** widens each copy to at least the ticker **client width** when natural text is shorter, so a loop still spans the visible viewport on large screens.
- **Design note** — Authority split for this HUD surface is recorded under *Public HUD messaging (header marquee)* in [docs/THE-LARGER-SYSTEM.md](../../../../docs/THE-LARGER-SYSTEM.md).
