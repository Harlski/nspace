# Public patch notes — players (`0.3.3`)

**Audience:** people who play or explore Nimiq Space — features, fixes, and feel; not implementation detail.  
**Depth:** short bullets or short paragraphs; avoid file paths and internal names unless they help (e.g. a renamed control).

---

- In **your own room** (not Hub/Chamber/Canvas), you can set where **new visitors** appear when they do not already have a saved spot in that room: turn on **Build**, choose **Entry spawn** in the tool list, then click a walkable floor tile. **Use room center** clears a custom point and goes back to the middle of the room bounds. A ring on the chosen tile is only visible while you are in build mode, so the space stays clean during normal play.
- **Gates:** if you open one but the far side is not a place you can walk onto (or there is no path across), the door still **opens visually** and you see a short on-world hint that you **cannot walk into that** — instead of silently failing or only using chat.
- **Gates (build):** while you place or move a gate, the two floor tiles on either side show a **soft green** tint when that side is clear to walk through, and **red** when something blocks it — but you can still **place** the gate if you want a decorative or intentionally blocked doorway. The old separate “swing” control is gone; the door always swings consistently from how you aim the opening.
- **Moving a gate:** you get a **see-through preview** of the door on the tile you are aiming at, and the green/red hints follow that preview. The **real** door where it stands today stays pointed the old way until you finish the move, so you are not confused by two doors both spinning at once.
- **Gate access:** the object menu uses **Permissions** (same editor as before), and picking someone to allow opening shows their **identicon** next to their name.
