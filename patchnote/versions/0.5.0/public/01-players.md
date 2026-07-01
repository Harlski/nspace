# Public patch notes — players (`0.5.0`)

**Audience:** people who play or explore Nimiq Space — features, fixes, and feel; not implementation detail.  
**Depth:** short bullets or short paragraphs; avoid file paths and internal names unless they help (e.g. a renamed control).

---

## Player Menu and profile

**[NEW] Player Menu** — Tap your identicon in the bottom-right for Wardrobe, **Shop**, Achievements, Rooms, **Return to Hub**, and Logout (guests see Profile, Get a Wallet, and Leave instead). Wardrobe and Shop open your profile on that tab; your full profile is one tap away on the **top-bar identicon**.

**[NEW] Long-press the Player Menu** — Hold the bottom-right identicon or name pill (~half a second) to open the **Action Wheel** around your avatar — the same menu as right-clicking yourself on desktop.

**[CHANGE] Profile layout** — Your profile is now a sheet with bottom tabs (**Wardrobe**, **Shop**, **Achievements**). On phones it slides up from the bottom; on desktop it stays a centred panel. Other players’ profiles stay read-only with the same tab bar.

## Achievements

**[NEW] Achievements** — Earn **achievement points (AP)** by hitting milestones across the world. Your profile’s **Achievements** tab shows total AP and recent unlocks; **View all progress** (or the Player Menu entry, or **`Y`**) opens the full **Achievements window** with categories, progress bars, and reward previews.

**[NEW] Unlock moment** — When you earn an achievement, a banner slides in (tap it to open the full list). Everyone in the room sees a brief **trophy celebration** above your avatar. Back-to-back unlocks queue so each gets its moment.

**[NEW] Achievement rewards** — Some milestones grant exclusive cosmetic trails you cannot buy in the shop — they appear in Wardrobe once unlocked.

**[NEW] Categories** — Progress spans Getting started, Commons building, Mining, Exploration (rooms, teleporters, distance), Worldcraft (floors, prefabs, signposts, gates), Social, and Football (matches and Free Play Field).

## Cosmetics and shop

**[NEW] Wardrobe paper doll** — Equip passive cosmetics (aura, nameplate, chat bubble, trail) from a character-style layout. Tap a slot to browse what you own and what’s in the shop, preview on your avatar, then **Equip** or **Buy**.

**[NEW] Shop tab** — When the shop is open, the **Shop** tab shows up to **5 featured cosmetics for the day** (the same picks for everyone), with **Buy** on each card — or **Equip** if you already own it. Deployables you own are marked “use from Action Wheel → Items.” A **Go to The Shaper** link sits below to try looks in-world.

**[CHANGE] Shop closed by default** — Until operators open the shop, the Shop tab shows **COMING SOON**; Wardrobe still holds everything you’ve earned through Achievements.

**[NEW] The Shaper, with a way back** — Visit **The Shaper** to preview cosmetics in the world (when the shop is open), then **Leave the Shaper** (Player Menu or on-screen button) to return to the room — and roughly the spot — you came from.

**[NEW] Other players’ profiles** — See their equipped passives and owned deployables (read-only); deployables are still used from the Action Wheel → Items.

**[CHANGE] Wardrobe preview** — Profile doll centre is a live WebGL view (avatar on a floor tile, isometric camera) instead of a flat identicon chip; updates with equipped passives and try-on preview.

**[CHANGE]** Closing your profile cancels any try-on preview that wasn’t equipped.

**[CHANGE] Slot labels** — Hover a wardrobe slot on desktop (or long-press on touch) to see its name before opening the picker.

## Navigation and controls

**[CHANGE] Room names** — The central home room is now **Hub** (where you spawn and resume). The open communal build room is **Commons**.

**[CHANGE] Return to Hub** — The top-bar escape control is labeled **Return to Hub** (same action as before).

**[CHANGE] Softer Action Wheel** — Right-click (or long-press) your avatar and the wheel now has rounded corners and lighter dividers. Each option shows just its icon; hover one and its name appears above the wheel, and the menu you're in shows its name below. On touch, tap once to see an option's name, tap again to use it (Close/Back still work in a single tap).

**[CHANGE] Browser back on overlays** — Pressing Back while a profile, achievements window, or similar overlay is open closes it instead of leaving the game.

**[FIX] Mobile wardrobe** — Portrait and narrow viewports (including the Nimiq Pay webview) now keep the avatar preview visible instead of hiding it behind a slots-only layout.

**[FIX] Sharper profile preview** — Identicon and name labels in the wardrobe doll render crisply on high-DPI phones.
