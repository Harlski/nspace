---
id: "cosmetic-shop-player-menu-shaper"
milestone: cosmetic-shop
depends_on: []
triage: ready-for-agent
status: todo
acceptance:
  - Player Menu removes Profile for full players and adds Shop; Wardrobe and Shop both open the self profile overlay on their matching tabs
  - Guests do not see Shop in the Player Menu
  - Server exposes a global daily random shelf of up to 5 Published shop-eligible Catalog Entries
  - Shop tab renders the featured shelf with Buy actions, owned/equip states, deployable handling, and a Shaper link
  - Buying from the shelf refreshes ownership and does not auto-equip
  - The Shaper is treated as player-facing and reachable outside development mode
  - Entering The Shaper from any navigation path records the previous room and approximate player position as a 30-minute session return target
  - The Shaper has both a Player Menu return action and an in-world return affordance, with Hub fallback
  - Server validates Shaper returns so client-stored room/position cannot bypass room access or teleport to invalid tiles
verify:
  - "npm test -w client -- actionWheelGeometry mobileBrowserPlay overlayBackStack"
  - "npm test -w server -- cosmeticStore cosmeticGallery"
  - "npm run build"
---

# Cosmetic Shop — Player Menu Shop and The Shaper return

PRD: [../cosmetic-shop.md](../cosmetic-shop.md)  
Vocabulary: [../../CONTEXT.md](../../CONTEXT.md) -> Player Menu, Wardrobe, The Shaper, Catalog Entry, Cosmetic Unlock, Deployable.

## What to build

Replace the duplicated **Profile** entry in the bottom-right **Player Menu** with **Shop** for full players. **Wardrobe** and **Shop** should both open the signed-in player's existing profile overlay, landing on the matching bottom tab. Guest menus stay focused on wallet onboarding and should not show Shop.

Change the profile **Shop** tab from a Shaper-only link into a compact featured shelf:

- Show a server-selected, global daily random set of up to 5 Published shop-eligible **Catalog Entries**.
- Pick from all Published shop entries, including items the player already owns and including **Deployables**.
- Exclude non-shop entries such as achievement-only SKUs.
- If fewer than 5 entries exist, show the available entries; if none exist, show an empty state.
- Each card shows enough information to buy confidently: thumbnail/swatch, name, price, and slot or collection.
- Unowned entries show **Buy**.
- Owned passive entries show **Equip**.
- Owned Deployables show **Owned** plus a note that they are used from **Action Wheel -> Items**.
- Successful Buy refreshes wardrobe/shop data and updates the card state; it must not auto-equip.
- Try-on remains an in-world Shaper behavior, not a shelf behavior. Cards may link to The Shaper for try-on.

Make **The Shaper** player-facing. The current `SPACER` / `cosmetic-gallery` room is still rough, but this slice should stop treating it as development-only at the access layer so the Shop tab can truthfully link to it. The richer Shaper experience can follow in later slices.

## Shaper Return

Every navigation into **The Shaper** should remember the room and approximate player position the player came from, whether entry came from Shop, a room code, a room list, or a future portal. The return target should survive reloads while the browser session lives, but expire after 30 minutes.

Expose two ways to leave The Shaper:

- A reliable **Return to previous room** action in the Player Menu while inside The Shaper.
- An in-world exit or portal affordance inside The Shaper.

Returning should attempt to restore the previous room plus approximate position. If the room no longer exists, is no longer joinable by the player, or the stored target is stale, return to **Hub** instead.

## Security constraints

The persisted return target is UX state, not authority. The server must validate any Shaper return request:

- Only honor the positioned return path while the player is currently in The Shaper.
- Apply the same room access rules used for normal joins.
- Treat the stored position as a spawn hint only.
- Snap the hint to a tile and accept it only if that tile is walkable in the target room.
- If the position is invalid, use the room's normal or saved spawn.
- If the room is invalid or inaccessible, fall back to Hub.

Do not add a generic "join arbitrary room at arbitrary coordinate" API that can be used outside the Shaper return flow.

## Implementation notes

Likely touch points:

- `client/src/ui/playerMenu.ts` for the full-player menu entries.
- `client/src/ui/hud.ts` for Player Menu action routing, profile tab selection, and Shaper return UI.
- `client/src/cosmetics/wardrobePanel.ts` for the featured Shop shelf and Buy/Equip card behavior.
- `client/src/cosmetics/api.ts` for any featured shelf response shape or refresh helper.
- `client/src/main.ts` and `client/src/net/ws.ts` for entering The Shaper, persisting the 30-minute session return target, and sending a constrained Shaper return request.
- `server/src/index.ts` / `server/src/cosmeticStore.ts` for server-selected global daily featured entries.
- `server/src/rooms.ts` and `server/src/cosmeticGallery.ts` for production Shaper access and validated return placement.
- `docs/prd/cosmetic-shop.md`, `docs/process.md`, `docs/features-checklist.md`, and patch notes if the implementation changes public behavior or dev/prod room semantics.

## Open follow-up

The Shaper room itself is not considered polished in this slice. This work makes it reachable and returnable; a later issue should improve the in-world try-on, layout, labels, and purchase path inside The Shaper.
