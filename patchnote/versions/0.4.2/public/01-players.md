# Public patch notes — players (`0.4.2`)

**Audience:** people who play or explore Nimiq Space — features, fixes, and feel; not implementation detail.  
**Depth:** short bullets or short paragraphs; avoid file paths and internal names unless they help (e.g. a renamed control).

---

- [PERF] **Smoother gameplay during NIM payouts** — reward sends no longer run on the same server thread that handles movement and chat, so the whole room should stop freezing when the payout wallet pays out.
- [FIX] **Rewards unchanged** — block claims, maze wins, World Cup goal rewards, and admin feedback payouts still queue the same way; you should not notice a change in amounts or timing except for less lag.
- **HUD payout balance** — the reward-pool balance in the UI still updates on the same cadence (slightly cached, as before).
