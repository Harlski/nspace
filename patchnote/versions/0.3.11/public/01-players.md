# Public patch notes — players (`0.3.11`)

**Audience:** people who play or explore Nimiq Space — features, fixes, and feel; not implementation detail.  
**Depth:** short bullets or short paragraphs; avoid file paths and internal names unless they help (e.g. a renamed control).

---

- [NEW] **Terms & Privacy on-site:** Open **Terms** and **Privacy Policy** from the lobby footer (and related links). You may need to tick that you agree before wallet sign-in when that line appears.
- [CHANGE] **Lobby wallet flow:** The “I have read and agree…” line stays hidden until you first tap the Nimiq **+** (or add-wallet **+** when you already have saved accounts). It then fades in. If you still need to tick, a short hint points at the agreement line; tick and tap the wallet **+** again to continue.
- [NEW] **Profiles from streaks:** Click a player name in the top login-streak bar to open their profile. Profiles list up to three of that player’s rooms with a **live headcount** and a small **people** icon; the busiest rooms are listed first. Your own profile can include **private** rooms too. Tap a room and confirm to join it.
- [NEW] **Player badge:** When more people are online in total than in your current room, the top player count can show **both** (in-room vs total) so you see activity where you are standing.
- [CHANGE] **Profile card layout:** The profile window is a bit wider and tidier — avatar, text, room list, and the wallet button line up more evenly.
- [NEW] **Copy message / Copy wallet:** Right-click a chat line for **View profile · Copy message · Translate**. Right-click another player for **View profile · Copy wallet** without opening their full profile.
- [FIX] **Chat is readable again:** Chat lines render in light text on the dark panel in every build (no more black-on-dark in production where another stylesheet won the cascade).
- [FIX] **Tap goes through name plates:** Tapping a player's name plate that visually covers a block (or other target) no longer hijacks the action — the tap reaches what's underneath when the body itself isn't on the ray.
- [CHANGE] **Lobby sign-in:** Use the Nimiq outline **+** control to open your wallet; with saved accounts, the same style **+** at the end of the row adds another wallet. Pick an avatar to see account actions (enter, forget, payouts where available).
