# Public patch notes — players (`0.3.25`)

**Audience:** people who play or explore Nimiq Space — features, fixes, and feel; not implementation detail.  
**Depth:** short bullets or short paragraphs; avoid file paths and internal names unless they help (e.g. a renamed control).

---

- **[NEW]** **Nimiq Pay (portrait)** — the game fills your phone screen in the Pay mini-app. **Build** opens a spread layout: object carousel and tabs along the bottom, **parameters** on the left, **color wheel** and **preview** on the right. **Prefab** mode uses the full width for your saved designs (no color wheel).
- **[NEW]** **Top bar (portrait Pay)** — brand, wallet, player count, NIM balance, and lobby exit sit on one row; **Return Home**, **Rooms**, and **Build** stack on the top-right. **Rooms** shows its label (not icon-only).
- **[CHANGE]** **Rooms picker (portrait Pay)** — shorter dialog instead of full-screen; your current room is shown under **Official rooms** for easier reading.
- **[CHANGE]** **Nimiq Pay welcome** — removed the “not yet fully supported” note; social links are icon-only with clearer labels.
- **[FIX]** **LAN dev testing** — opening the client from a home-network IP (e.g. `192.168.x.x`) keeps WebSocket on `ws://` when the page is `http://`, so local phone testing works.
