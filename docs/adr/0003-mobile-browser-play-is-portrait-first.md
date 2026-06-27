# Mobile Browser Play is portrait-first

Mobile browsers used to be treated like touch devices that should be pushed into fullscreen
landscape, while Nimiq Pay carried the only true portrait game presentation. We decided that
**Mobile Browser Play** starts from first page load in **Portrait Play**: a true portrait canvas
that fits the visible browser viewport, with a **Curated Mobile HUD** and no forced fullscreen.

Players enter **Landscape Play** by physically rotating the device. In landscape the client may
request immersive fullscreen as a best-effort enhancement, but the game must remain playable if
the browser denies it; rotating back to portrait releases the forced/immersive assumption and
returns to the normal browser viewport. **Portrait Play** and Nimiq Pay portrait should share one
core mobile portrait layout, with Pay-specific WebView and chrome behavior layered separately.

We accepted this over preserving the old forced-landscape policy because portrait is the native
entry posture for mobile browser users, and fitting the visible browser viewport is less hostile
than immediately fighting the OS/browser orientation. Keep a hidden **Fallback Mobile
Presentation** available so operators can roll back quickly if a real mobile browser exposes a
serious layout or input issue.
