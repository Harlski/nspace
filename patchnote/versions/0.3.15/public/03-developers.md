# Public patch notes — developers (`0.3.15`)

**Audience:** contributors and integrators — APIs, WS messages, module boundaries, notable refactors.  
**Depth:** summarized technical changelog; not a full file list (that stays in [../reasons.md](../reasons.md)).

---

- **[FIX]** [client/src/ui/hud.ts](../../../../client/src/ui/hud.ts) — debug overlay hidden by default; `isDebugPanelVisible()` / `setDebugPanelVisible()`; self-profile identicon toggles `.hud-debug`.
- **[CHANGE]** [client/src/main.ts](../../../../client/src/main.ts) — no longer enables debug HUD via `import.meta.env.DEV`; `?debug` still sets initial visibility; RAF stats only when panel visible.

Full inventory: [../reasons.md](../reasons.md).
