# Public patch notes — hotfix (`0.4.0`)

**Audience:** anyone catching up on a corrective release — what broke in production-facing UX, what we shipped, why it could not wait.  
**Depth:** short; not a substitute for Brief → Developers or full [../reasons.md](../reasons.md).

---

- [FIX] **What was wrong:** On **production mobile** wallets, the main-menu **“I agree to Terms…”** row looked warped — a wide empty strip between the **checkbox** and the **text**, wrapping that split the sentence awkwardly, and the box sat too high relative to multi-line copy. **Desktop / wide viewports** often masked it because centered lines still looked close to the control.
- [FIX] **Root cause:** The login card uses **centered** body text; that alignment **inherited** into the consent label’s flexible text span, so each line was **centered inside a full-width column** while the checkbox stayed at the **flex start** — on narrow widths that reads like broken layout, not intentional spacing.
- [FIX] **What we changed:** Force **left alignment** on the terms row and label text, **vertically center** the checkbox with the wrapped block, and zero **padding/margin** drift on the custom checkbox so alignment is stable across WebKit engines.
- **Why now:** First-run / returning login is **identity-gating**; confusing consent UI undermines trust and can block sign-in on small screens until users guess the hit target.
- **Follow-up:** None required from operators beyond a normal **client deploy**; no API or WebSocket changes.
