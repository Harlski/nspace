# Reasons — 0.3.2 (patch-notes version)

**Patch-notes version:** `0.3.2` (frozen via `npm run prepare-merge`).

**Role:** Technical **reasons** attached to **this** patch-notes version — file-level and behavior-level inventory. Public-facing copy at other depths lives only under [public/](public/).

---

## Summary

In-game **header marquee**: server-driven streak leaderboard + optional rotating **`newsMessages[]`**; client seamless horizontal ticker with **loop tied to CSS `animationiteration`**, **viewport-wide travel** on large screens via per-chunk fill, and remeasure on resize / identicon loads. Normative split recorded in [docs/THE-LARGER-SYSTEM.md](../../../docs/THE-LARGER-SYSTEM.md).

---

## By area

### Repo / docs

- [docs/THE-LARGER-SYSTEM.md](../../../docs/THE-LARGER-SYSTEM.md) — *Recorded decision*: public HUD header marquee (server payload + timing bounds vs client layout / scroll / loop width).
- [docs/reasons/reason_770142.md](../../../docs/reasons/reason_770142.md) — rationale for that doc update.
- [docs/features-checklist.md](../../../docs/features-checklist.md) — marquee behavior line aligned with implementation.
- [docs/build.md](../../../docs/build.md) — HTTP overview notes client-side scroll for `/api/header-marquee`.

### Client

- [client/src/ui/headerMarquee.ts](../../../client/src/ui/headerMarquee.ts) — Poll `GET /api/header-marquee`; build streak ticker (two identical **chunks**); **`attachStreakTickerScroll`**: clear/set **`.hud-header-marquee__ticker-chunk-fill`** flex width so `max(naturalChunkWidth, viewportWidth)` per loop; `ResizeObserver` on ticker wrap + track; `img` **load/error** (+ `complete`) → debounced resync; **`animationiteration`** → advance streak → message (with server **`marqueeStreakSeconds`** fallback timer); dedupe/disambiguate leaderboard rows for display.
- [client/src/style.css](../../../client/src/style.css) — `.hud-header-marquee__*` ticker viewport, mask, **`hud-header-marquee-scroll`** keyframes `translateX(0)` → `translateX(-50%)`, track/chunk `flex-shrink: 0`, **`ticker-chunk-fill`** defaults.
- [client/src/ui/hud.ts](../../../client/src/ui/hud.ts) — Marquee host inside top HUD strip (layout integration).

### Server

- [server/src/headerMarqueeSettingsStore.ts](../../../server/src/headerMarqueeSettingsStore.ts) — JSON persistence (`HEADER_MARQUEE_SETTINGS_FILE`); **`newsMessages[]`**, **`marqueeStreakSeconds`** (clamped), **`marqueeMessageSeconds`**, toggles; legacy **`newsMessage`** migration.
- [server/src/index.ts](../../../server/src/index.ts) — **`GET /api/header-marquee`** (public); **`GET`/`PUT /api/admin/header-marquee`** (admin JWT); payload merges settings + streak leaderboard.
- [server/src/adminHeaderPage.ts](../../../server/src/adminHeaderPage.ts) — HTML **`/admin/header`** editor for marquee settings.
- [server/src/loginStreakStore.ts](../../../server/src/loginStreakStore.ts) — Streak ledger; leaderboard input; **normalized wallet dedupe** for top list.
- [server/.env.example](../../../server/.env.example) — `HEADER_MARQUEE_SETTINGS_FILE`, streak store path (if documented there).

### payment-intent-service

- _(none in this change set)_

### Deploy / ops

- [client/vercel.json](../../../client/vercel.json) / root [vercel.json](../../../vercel.json) — rewrite **`/admin/header`** to API host where split deploy applies.
