# Public patch notes — players (`0.3.2`)

**Audience:** people who play or explore Nimiq Space — features, fixes, and feel; not implementation detail.  
**Depth:** short bullets or short paragraphs; avoid file paths and internal names unless they help (e.g. a renamed control).

---

- **Login streaks:** Signing in on consecutive UTC days builds a streak. When the feature is on, a slim strip at the top of the game can show top streak holders (with small avatars) and short messages from the team.
- **Banner motion:** The streak line scrolls horizontally in a continuous loop. On large displays, one full pass still moves across the **whole width** of the strip so it does not look like a tiny nudge before repeating.
- **Rotation:** If both streaks and news lines are enabled, the strip switches from the streak view to a news line after a **full scroll cycle**, then shows each news line for the time the operators configured.
