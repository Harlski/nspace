# Public patch notes — players (`0.3.22`)

**Audience:** people who play or explore Nimiq Space — features, fixes, and feel; not implementation detail.  
**Depth:** short bullets or short paragraphs; avoid file paths and internal names unless they help (e.g. a renamed control).

---

## Pixel board

- [NEW] From the **Hub**, take the **north door** to **Pixel** — a **500×500** shared floor canvas.
- [NEW] Paint floor tiles with the floor color tool (**F**); blocks, gates, and other objects are not available here.
- [NEW] The canvas starts as a **checkerboard** with a **black square** around the center hub landing — only tiles you (and others) paint are stored, and your art persists for everyone.
- [NEW] When painting, choose a **1×1** or **2×2** brush size (floor mode only).
- [CHANGE] You arrive near the **center hub door** each time you enter Pixel.
- [CHANGE] On very large maps, non-admin players see a **limited zoom / view area** so the client stays responsive; admins and stream bots can still see more.
- [NEW] Switching rooms shows a **loading screen** with progress while the new space loads.

## Stream view (optional)

- Operators may share a broadcast URL like `?room=pixel&stream=1` — no HUD, top-down view, slow pan across the board.
- [NEW] `streamFollow=1` alternates a wide overview with short **spotlight** shots on random players; a top bar shows **Following {name}** while spotlight lasts.
- [NEW] `noScroll=1` keeps the overview camera fixed (no slow pan).
- [NEW] `streamChat=1` shows chat bubbles on stream; without it, speech bubbles stay hidden.
- Anyone can open **`/pixels.png`** on the site for a **live PNG** of the current board (refresh to update).
