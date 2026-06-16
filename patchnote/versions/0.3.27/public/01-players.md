# Public patch notes — players (`0.3.27`)

**Audience:** people who play or explore Nimiq Space — features, fixes, and feel; not implementation detail.  
**Depth:** short bullets or short paragraphs; avoid file paths and internal names unless they help (e.g. a renamed control).

---

## Billboard advertising (advertisers)

- **[NEW]** **Advertise** dashboard (`/advertise`) — sign in with your Nimiq wallet, create a campaign (project name, URL, image, on-screen duration), and **Fund** with NIM.
- **[NEW]** After payment, campaigns go to **Pending approval**; once approved, your advert appears on **billboards around the game**. Status shows **Live** when players can see it.
- **[NEW]** **How advertising works** guide (`/advertise/how-it-works`) — short step-by-step from campaign creation to in-game display.
- **[NEW]** **Prepaid visibility** — default **100 NIM ≈ 24 hours** of on-screen time when players are watching; balance drains only while active players are within **7 blocks** with the game tab open (not AFK).
- **[NEW]** **Time left** on your dashboard reflects **remaining balance**, not a fixed end date — quiet periods use less NIM.
- **[NEW]** **Add funds** on approved and **live** campaigns — top up without re-approval or going offline.
- **[NEW]** **Audience** stats on your campaign: unique viewers, total and average on-screen time, link visits, last seen.
- **[NEW]** **Transaction history** per campaign with nimiq.watch links.
- **[NEW]** **3D preview** of your billboard image on the dashboard before and after approval.
- **[NEW]** Upload an image from your device or paste an HTTPS image URL; inline **Choose file** on the form.
- **[FIX]** Payment modal now shows a confirming spinner and a success tick when on-chain payment lands.
- **[FIX]** Prepaid **NIM left** could read higher than total funded after top-up; balances now match payment history minus real visibility use.

## In-game (everyone)

- **[NEW]** Paid campaign billboards in the world; **Visit** opens the advertiser’s project URL (HTTPS in Nimiq Pay).
- **[CHANGE]** Billboard visibility billing only counts you as a viewer when you’re nearby, tab-visible, and active in the game.
- **[CHANGE]** Removed dev **Test Radio mini-app** smoke-test button from the HUD.
