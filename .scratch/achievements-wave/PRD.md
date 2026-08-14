---
title: Achievements wave — Level, cosmetics, rooms
status: ready-for-agent
glossary: CONTEXT.md
adrs:
  - docs/adr/0014-player-level-daily-earn-allowance.md
  - docs/adr/0015-sale-displays.md
depends_on_grill: CONTEXT.md (Temporarily unavailable, Cosmetics achievement Category, Player Level, Shop, The Shaper, Sale Display, Whisper, Other Player Menu, Play Space, Direct Invite, Teleporter)
---

# Achievements wave — Level, cosmetics, rooms

> Vocabulary follows [CONTEXT.md](../../CONTEXT.md): **Player Level**, **Achievement
> Points**, **Temporarily unavailable**, **Progress Overview**, **Achievements Window**,
> **Shop**, **The Shaper**, **Sale Display**, **Cosmetic Unlock**, **nameplate**, **chat
> bubble**, **Whisper**, **Other Player Menu**, **Play Space**, **Direct Invite**,
> **Teleporter**, **Set**, **Unlock Pad**, **Tutorial Room**.

## Problem Statement

A large set of player-facing systems has shipped (Player Level, Shop, The Shaper, Sale
Displays, nameplate and chat bubble Slots, Other Player Menu, Whisper, public rooms,
Teleporter linking, Play Space) while the achievement registry still mostly celebrates
older loops (Commons, mining, Pixel, Football). Players who reach a Level, list a room, or
use the new social and cosmetics surfaces get Achievement Points only by accident, and
nameplate / chat bubble cosmetics cannot be earned as achievement-only rewards.

Operators also cannot open or close Shop from `/admin/settings`; Shop is env-only, so a
closed shop still presents commerce achievements as ordinary incomplete rows.

## Solution

Add **21 new achievements** (~1/3 Player Level ladder, ~2/3 feature milestones), plus
**achievement-only nameplate and chat bubble SKUs** on four of those rows. Shop gains an
admin runtime toggle (env hard-close remains). While Shop is closed, the four commerce
rows show **Temporarily unavailable**, stay listed, and drop out of Progress Overview
fractions until they are Complete.

Existing achievements are unchanged (including Point Hunter I/II and First NIM). No
Level 11 trophy (that is 1000 Achievement Points, already Point Hunter II). Football
seasonal pause is not retrofitted with this label.

### The 21

| # | Title | Category | Points | Reward | Criterion |
|---|-------|----------|--------|--------|-----------|
| 1 | On the Board | Meta | 25 | — | Player Level 5 |
| 2 | Double Digits | Meta | 50 | Neon Frame nameplate (`ach-*`) | Player Level 10 |
| 3 | Established | Meta | 75 | — | Player Level 15 |
| 4 | Open House | Worldcraft | 25 | Simple Frame nameplate (`ach-*`) | First public owned room |
| 5 | Room to Room | Worldcraft | 25 | Dark Sharp chat bubble (`ach-*`) | Teleporter from a room you own to a different room you own |
| 6 | Between Us | Social | 15 | Pastel Rounded chat bubble (`ach-*`) | First Whisper |
| 7 | Window Shopper | Cosmetics | 10 | — | Open Shop |
| 8 | Enter The Shaper | Cosmetics | 15 | — | Visit The Shaper |
| 9 | Try Before You Buy | Cosmetics | 15 | — | Try a bound Sale Display |
| 10 | Paid in Style | Cosmetics | 25 | — | First Cosmetic Unlock **purchase** |
| 11 | Take a Look | Social | 10 | — | Other Player Menu → View Profile |
| 12 | Company | Worldcraft | 40 | — | First unique public-room visitor |
| 13 | Private Room | Play Space | 10 | — | Open your Play Space |
| 14 | Come On In | Play Space | 40 | — | Host: Guest claims Direct Invite |
| 15 | Framed | Cosmetics | 10 | — | Equip a nameplate Slot on Loadout |
| 16 | Caption | Cosmetics | 10 | — | Equip a chat bubble Slot on Loadout |
| 17 | Two Keys | Worldcraft | 15 | — | Own two persisted rooms |
| 18 | Knock Knock | Exploration | 15 | — | Visit a public player-owned room |
| 19 | Extra Hands | Worldcraft | 15 | — | Add a builder on a room you own |
| 20 | Housewarming | Worldcraft | 50 | — | Three unique public-room visitors |
| 21 | Toll Crossed | Exploration | 15 | — | Unlock Pad grant outside Tutorial Room |

Flavor titles; descriptions stay literal (e.g. “Reach Player Level 10.”).

## User Stories

### Level ladder

1. As a signed-in player, I want **On the Board** when I reach Player Level 5, so that
   early achievement hunting has a named status rung.
2. As a signed-in player, I want **Double Digits** when I reach Player Level 10, so that
   the nameplate Level badge has a matching trophy.
3. As a signed-in player, I want **Established** when I reach Player Level 15, so that
   climbing past Daily Earn Allowance uncap still has a trophy (Level 15 is 1400 Achievement
   Points, not 1000).
4. As a signed-in player, I do not want a Level 11 achievement, so that Point Hunter II
   remains the 1000 Achievement Points meta row.
5. As a signed-in player, I want these rows to use Player Level (what the nameplate shows),
   not a second raw Achievement Points ladder, so that Meta stays coherent with Point Hunter.
6. As a guest, I want none of these, so that Player Level stays wallet-only.

### Nameplate and chat bubble rewards

7. As a signed-in player who completes Open House, I want an achievement-only Simple Frame
   nameplate in Wardrobe, so that listing a room is visible on my avatar.
8. As a signed-in player who completes Double Digits, I want an achievement-only Neon Frame
   nameplate, so that Level 10 status has a matching frame.
9. As a signed-in player who completes Between Us, I want an achievement-only Pastel Rounded
   chat bubble, so that private speech has a matching bubble.
10. As a signed-in player who completes Room to Room, I want an achievement-only Dark Sharp
    chat bubble, so that linking my rooms has a matching bubble.
11. As a shopper, I still want the existing shop nameplate and chat bubble Catalog Entries
    buyable, so that earning and buying are not the same SKU.
12. As a player, I want other new rows to grant Achievement Points only, so that we do not
    invent extra Slot art in this wave.
13. As a player unlocking an `ach-*` SKU, I want the existing achievement entitlement grant
    path (not a shop purchase), so that rewards stay `achievement_only`.

### Rooms and Teleporters

14. As a room owner, I want **Open House** the first time a room I own is public (create
    public or later toggle), so that listing is celebrated separately from Room Maker.
15. As a room owner, I do not want Play Spaces or official rooms to count for Open House, so
    that only my persisted player rooms qualify.
16. As a room owner, I want **Room to Room** when I Set a Teleporter in a room I own to a
    **different** room I also own, so that building an estate is taught as a graph.
17. As a room owner, I do not want same-room linked pairs, Hub, Commons, The Shaper, or Play
    Spaces to complete Room to Room, so that the trophy matches “two of mine.”
18. As a room owner, I want one-way to be enough, so that a later reverse-link beat is not
    required here.
19. As a room owner, I want **Two Keys** when I own two persisted non-deleted player rooms,
    so that a second room is a milestone (Play Spaces and official rooms do not count).
20. As a room owner, I want **Extra Hands** when I add another wallet as a builder on a room
    I own, so that collaboration is recognized at ACL write, not after they place a block.
21. As a room owner, I want **Company** when the first unique other wallet enters a public
    room I own, so that listing has social proof.
22. As a room owner, I want **Housewarming** at three unique such wallets, so that Company
    and Housewarming are one visitor ladder.
23. As a room owner, I do not want myself, Guests, repeat visits, or private-room entries to
    count on that ladder, so that the counter stays honest.
24. As a visitor, I want **Knock Knock** when I enter a public player-owned room that is not
    mine, so that visiting listed rooms is distinct from Explorer (any other room).

### Social, Other Player Menu, Play Space

25. As a wallet player, I want **Between Us** on my first Whisper, so that private chat has
    a trophy (Hello World stays public chat).
26. As a player, I want **Take a Look** when I choose View Profile from the Other Player
    Menu, so that looking at someone else is distinct from Know Thyself.
27. As a player, I want **Private Room** when I open my Play Space, so that Home → Private
    Room is celebrated.
28. As a Play Space host, I want **Come On In** once when a Guest successfully claims my
    Direct Invite and lands in that Play Space, so that inviting in is the host trophy.
29. As a Guest, I do not want Come On In, so that the row stays a host achievement.
30. As a host, I do not want opening Play Space alone to complete Come On In, so that the
    two Play Space rows stay distinct.

### Cosmetics commerce and Loadout

31. As a player, I want **Window Shopper** when I open Shop (Player Menu or equivalent Shop
    tab), so that discovering the store is a beat.
32. As a player, I want **Enter The Shaper** when I enter The Shaper, so that the showroom
    visit is a beat (Grand Tour remains a same-UTC-day set including that room).
33. As a player, I want **Try Before You Buy** when I open a bound Sale Display’s try/buy
    flow (Wardrobe Preview only), so that trying is recognized without a purchase.
34. As a player, I want **Paid in Style** on my first successful Cosmetic Unlock **purchase**
    (Shop shelf or Sale Display), so that spending NIM on a Catalog Entry is a beat.
35. As a player, I do not want achievement grants, admin grants, or `achievement_only` SKUs
    to complete Paid in Style, so that it stays a shop purchase.
36. As a player, I want **Framed** when I persist a nameplate Slot on Loadout, so that the
    new Slot is taught beyond Suited Up.
37. As a player, I want **Caption** when I persist a chat bubble Slot on Loadout, so that
    that Slot is taught the same way.
38. As a player, I do not want Sale Display try-on or Wardrobe Preview to complete Framed or
    Caption, so that Equip means save.
39. As a player, I still want Suited Up for the first equip of any Slot, so that the new
    rows are additive.

### Unlock Pad

40. As a player, I want **Toll Crossed** when I receive an Unlock Pad Grant in a room that
    is not the Tutorial Room, so that paid crossings in the live world are celebrated.
41. As a learner, I do not want Tutorial Path Pay Ack or Tutorial Sandbox pads to count, so
    that First NIM stays the tutorial trophy.
42. As a player, I want Toll Crossed to remain an ordinary incomplete Exploration row when
    no non-tutorial pads exist, so that we do not invent a flicker Unavailable from pad
    count.

### Shop admin toggle and Temporarily unavailable

43. As an operator, I want a Shop checkbox on `/admin/settings`, default on, so that I can
    open or close Shop without a redeploy.
44. As an operator, I want `SHOP_ENABLED=0` to still hard-close Shop regardless of that
    checkbox, so that deploy profiles keep a kill switch.
45. As an operator, I want closing Shop to close The Shaper joins, the Shop tab, and Cosmetic
    Unlock, matching today’s env coupling.
46. As an operator, I want `SHAPER_ENABLED=0` to remain env-only room hide, so that I can
    hide The Shaper while Shop stays open.
47. As a player, when Shop is closed, I want Window Shopper, Enter The Shaper, Try Before
    You Buy, and Paid in Style to show **Temporarily unavailable**, so that I know they are
    not currently completable.
48. As a player, when Shop is open but The Shaper room is hidden, I want only Enter The
    Shaper Temporarily unavailable, so that Hub kiosks and Shop still count.
49. As a player, I want those rows still listed (not hidden), so that the Cosmetics Category
    does not vanish.
50. As a player who already completed one of those rows, I want it to stay Complete while
    Shop is closed, so that availability never revokes a trophy.
51. As a player, I do not want progress to increment on those rows while they are Temporarily
    unavailable, so that closed-shop actions cannot sneak a complete.
52. As a player, I want incomplete Temporarily unavailable rows omitted from Progress
    Overview earned/total (overall and per-Category), so that a closed Shop does not make me
    look stuck.
53. As a player, I want Complete rows still in that fraction even while Shop is closed.
54. As a Football player, I want seasonal pause unchanged (no Temporarily unavailable label)
    in this wave.
55. As a player with a live session, I want Shop close/open to update COMING SOON and
    Temporarily unavailable without a rebuild, so that the admin toggle is real.

### Catch-up and celebration

56. As a veteran who already meets a reconstructable criterion (Player Level, public owned
    room, two owned rooms, nameplate or chat bubble already on Loadout, a builder already
    listed, an existing shop purchase), I want silent Complete on login, so that I am not
    locked out of old work.
57. As that veteran, I do not want Achievement Unlock Banners or Celebrations on that
    catch-up, so that a content drop does not toast-storm the room.
58. As a player who Whispered, tried a Sale Display, opened Play Space, hosted a Guest,
    viewed a profile, visited The Shaper, opened Shop, crossed a pad, or received visitors
    **before** this wave, I accept those rows starting at zero, so that we do not scan the
    Event Log.
59. As a player who completes a row by a live action after deploy, I want the normal Banner
    (and Celebration) path, including cosmetic-grant toast when an `ach-*` SKU is new.
60. As a veteran whose silent catch-up grants Open House or Double Digits, I still want the
    `ach-*` SKU in Wardrobe, so that silence applies to presentation, not to the entitlement.

### Achievements Window

61. As a signed-in player, I want a **Cosmetics** Category in the Category Navigator for the
    six cosmetics rows, so that Shop/Shaper/Slot beats are not stuffed into Getting started.
62. As a signed-in player, I want Play Space Category rows for Private Room and Come On In,
    so that the unused Play Space Category is finally used.
63. As a signed-in player, I do not want new Getting started rows, so that Telescope’s
    prerequisite set is unchanged.
64. As a signed-in player, I want descriptions to state the criterion in plain language, so
    that flavor titles never hide the goal.

## Implementation Decisions

### Seams

- **Achievement registry + progress store** is the unlock authority. New definitions,
  criteria, `ach-*` catalog rows, catch-up evaluators, and Temporarily unavailable live
  here. World and HTTP code only fire events or expose shop/Shaper flags.
- **Shop gate** (`isShopPubliclyOpen`) becomes env **and** admin runtime `shopEnabled`
  (tutorial-style). Shaper joins, featured shelf, and Cosmetic Unlock stay behind it.
  `SHAPER_ENABLED` stays env-only.
- **Achievements API / Window** expose availability per row. Progress Overview math omits
  incomplete Temporarily unavailable.

### Shop runtime (required for the admin checkbox)

- Server truth: Shop is open iff `SHOP_ENABLED !== "0"` **and** admin `shopEnabled`
  (default true).
- Client must not rely only on compile-time `VITE_SHOP_ENABLED`. Welcome (or equivalent
  session flag) carries Shop open and Shaper reachable; admin PATCH broadcasts or the next
  welcome/delta refreshes COMING SOON and achievement availability.
- Compile-time `VITE_SHOP_ENABLED=0` may still force a closed SPA for that build; it must
  not be the only close path.

### Criteria and events

- Player Level rows: evaluate from current Achievement Points → Player Level (same formula
  as the nameplate). Completing a Level row may itself grant points; that is acceptable and
  already true of Point Hunter.
- Open House / Two Keys / Extra Hands: state from the room registry (owner, `isPublic`,
  non-deleted, `builderAddresses`).
- Room to Room: event when a Teleporter is Set with source room owner = dest room owner,
  dest ≠ source, dest is a persisted player room (not builtin / Play Space).
- Visitor ladder: lifetime unique other wallets entering a public room owned by the
  celebrant; Company threshold 1, Housewarming 3, shared seen-prefix.
- Whisper, Other Player Menu View Profile, open Shop, enter The Shaper, Sale Display try,
  Cosmetic Unlock purchase success, open Play Space, Direct Invite Guest claim, persist
  nameplate/chat bubble Loadout, Unlock Pad Grant outside Tutorial Room: event keys fired
  at existing hook sites.
- Paid in Style: entitlement source `purchase` only.
- Try vs Equip: try = Sale Display try/buy opened (preview); equip = Loadout save for that
  Slot.
- Toll Crossed: pad grant room id is not the Tutorial Room (lesson or Sandbox).

### Availability

- Definitions for Window Shopper, Enter The Shaper, Try Before You Buy, Paid in Style
  declare a shop (and Shaper, for Enter The Shaper) feature dependency.
- While the dependency is off and the row is not Complete: `temporarily_unavailable`;
  event/counter increments for those defs are ignored (Football pause pattern).
- Progress Overview: filter those incomplete rows out of earned and total.

### Catch-up

- On login (and silent on achievements fetch, same Banner rule as login-streak heal):
  evaluate reconstructable defs; Complete + grant `rewardSku` without Banner/Celebration.
- Reconstructable: Level 5/10/15, Open House, Two Keys, Extra Hands, Framed, Caption, Paid
  in Style (existing purchase entitlement).
- Not reconstructable: Whisper, Take a Look, try, Play Space, Come On In, visitors, Knock
  Knock, Toll Crossed, Window Shopper, Enter The Shaper.

### Cosmetics catalog

- Four new `ach-*` SKUs that **reuse** presets `nameplate-frame-simple`,
  `nameplate-frame-neon`, `bubble-rounded-pastel`, `bubble-sharp-dark` (or achievement-only
  preset ids that render identically). Shop Catalog Entries keep distinct SKUs.
- Grant via existing `EntitlementSource` `achievement`.

### Docs

- Keep `CONTEXT.md` terms already added (**Temporarily unavailable**, **Cosmetics** as
  achievement Category).
- Record Shop admin+env gate and Temporarily unavailable vs Football pause in process /
  features-checklist when shipping; optional short ADR if the runtime Shop flag surprises
  operators.

## Testing Decisions

### What makes a good test

- Assert external behavior: given wallet state / an event / Shop open or closed, which rows
  Complete, which SKUs are granted, whether Banner/Celebration would fire, and how Progress
  Overview fractions change.
- Prefer the achievement store and pure availability helpers over `rooms.ts` theater.
- Do not snapshot Wardrobe or Three.js; reward is “SKU entitled.”
- Do not Event-Log-scan tests for catch-up; state fixtures only.

### Modules / seams to test

1. Shop open helper: env kill switch, admin `shopEnabled`, default on.
2. Availability + Progress Overview: incomplete unavailable omitted; Complete counted;
   Football unchanged.
3. Level threshold defs vs Point Hunter (no Level 11 row; Level 15 ≠ 1000 AP).
4. Catch-up silent vs live Banner policy (login-streak prior art).
5. Room state defs: public toggle, two rooms, builder ACL, owned-to-owned Teleporter Set
   exclusions (same-room pair, Hub, Play Space).
6. Visitor dedupe: owner, Guest, private, repeat visit.
7. Purchase vs achievement grant for Paid in Style; try vs Loadout save for Framed/Caption.
8. Toll Crossed ignores Tutorial Room grants.
9. `ach-*` nameplate/chat bubble not purchasable (`achievement_only`).

### Prior art

- Achievement store tests (events, counters, `ap_threshold`, login-streak silent fetch).
- Player Level pure helpers.
- Shop access tests (env close).
- Admin runtime settings tests (tutorial flag persist).
- Achievements `panelData` tests (Progress Overview, Category labels).
- Cosmetic store `achievement_only` purchase reject.

## Out of Scope

- Retrofitting Temporarily unavailable onto Football seasonal pause.
- Extra Tutorial Path achievements (First NIM remains the tutorial beat).
- Admin Invisibility, Freeze, Path Playback trophies.
- Bidirectional “estate loop” Teleporter achievement (one-way is enough).
- Opening the Achievements Window as a trophy.
- New nameplate/chat bubble **visuals** beyond cloning the four existing presets as `ach-*`.
- Changing existing achievement points or Telescope prerequisites.
- Event Log backfill.
- Guest achievements.
- Localization beyond current i18n status.
- Hiding Cosmetics Category entirely when Shop is closed (rows stay, labeled).

## Further Notes

- Default owned-room cap is 3, so Two Keys and Room to Room are possible.
- Company (40) and Housewarming (50) share one unique-visitor counter.
- Completing Double Digits grants 50 Achievement Points and may bump Level; same pattern as
  Point Hunter.
- Implement tickets should stay vertical (one demoable slice per fresh context window);
  Shop runtime gate is the prefactor that makes commerce availability real.
