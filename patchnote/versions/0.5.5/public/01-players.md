# Public patch notes — players (`0.5.5`)

**Audience:** people who play or explore Nimiq Space — features, fixes, and feel; not implementation detail.  
**Depth:** short bullets or short paragraphs; avoid file paths and internal names unless they help (e.g. a renamed control).

---

- [NEW] **Private whispers.** Send someone a private message a few ways: type **`/w name your message`** (also `/whisper` or `/tell`), or **right-click a player or a chat line and pick "Whisper"**. The chat box now shows where your message is going with a label on the left - **"Say:"** for the room or **"Name:"** when you're whispering. Press **Tab** to cycle that label between the room and people you've recently whispered, or click it to pick someone from a list. Reply to your last whisper instantly with **`/r`**. While a whisper target is set, everything you type goes just to them until you switch back (press **Esc**, or **Backspace** on an empty box, or Tab back to "Say"). Whispers show up privately in your chat with their own color, never float above your head, and never appear in room chat. They reach the other player wherever they are in the world, as long as they're online and signed in with a wallet.
- [NEW] **See who comes and goes.** A small presence feed now appears above the chat when players **enter or leave** the room, each with their avatar - not just a one-off "entered" popup.
- [CHANGE] **Room browser polish.** The room preview now shows the **owner's avatar** (click it to view their profile), the browser has a clearer **close button**, and your **browser/phone back button** now steps back through the room browser instead of leaving the game.
- [FIX] **Pixel room preview.** Browsing to the Pixel room in the room list now shows a real top-down snapshot of the board around the spawn, instead of an empty preview.
- [FIX] **No more rare black screen.** Fixed a bug where opening room previews could, over time, black out the main game view until you reloaded.
- [CHANGE] **Free Play Field badge.** The goal-payout badge is now **"98% is good enough"** and unlocks at **0.98 NIM** received. It was previously "Paid in Full" at 1 NIM, which could stay locked because a payout arrives a hair under 1 NIM after network rounding.
- [CHANGE] The Nimiq Space info pages (payout queue, analytics, and admin tools) now share one consistent look, with the **X** and **Telegram** links moved into a tidy footer alongside a "Nimiq Space 2026" note. Signing in on those pages now works the same way as the main game, including inside Nimiq Pay.
