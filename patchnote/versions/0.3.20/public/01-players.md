# Public patch notes — players (`0.3.20`)

**Audience:** people who play or explore Nimiq Space — features, fixes, and feel; not implementation detail.  
**Depth:** short bullets or short paragraphs; avoid file paths and internal names unless they help (e.g. a renamed control).

---

- **[FIX]** **Expired account Re-login** — pick a saved account that shows **Expired**, tap **Re-login**, and the full **Terms / Privacy** checkbox appears where the expiry line was. Check the box and tap **Re-login** again to sign in with your wallet.
- **[FIX]** **Stacked cubes** — when cubes sit on top of each other, the lower block’s color should read correctly at the seam.
- **[FIX]** **Rotated cubes** — rotated plain cubes render and outline correctly when placed on a stack.
- **[NEW]** **Prefab library** — in build mode, open **Library** on the prefab strip to choose which saved designs appear in your dock (checkmarks, size filter). Favorites are remembered per wallet on this device.
- **[NEW]** **Prefab create & place** — **Create** captures a floor area (up to 6×6 tiles) with a live preview above the build menu; **Place** stamps a design in any room where you can place objects. Publishing is always free; prefab names are limited to 12 characters.
- **[NEW]** **Mobile prefab placement** — on touch devices, tap the floor to preview, tap the same spot again or tap green **Place** to confirm, and red **Cancel** (or Escape) to clear the preview without placing.
- **[CHANGE]** **Prefab build menu** — the dock strip uses **CREATE**, **LIBRARY**, and design cards instead of separate Save/Place mode buttons; closing build mode with **B** returns you to the **Terrain** tab next time.
- **[NEW]** **Walk-through in the build dock** — with an object selected, use the eye control next to rotate/delete for solid vs walk-through collision.
- **[FIX]** **Prefabs on raised floor** — designs can be placed on extra-floor tiles, not only the base grid.
- **[FIX]** **Prefab preview** — closing build mode clears a leftover ghost; placing one copy no longer hides the preview for the next placement of the same design.
- **[FIX]** **Walk-through toggle** — the dock eye button no longer flips back immediately.
