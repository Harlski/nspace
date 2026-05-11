# Public patch notes — hotfix (`0.3.11`)

**Audience:** anyone scanning for **what broke in production** and **what we corrected** in this semver — without rereading Brief → Developers.  
**Depth:** short incident-style summary; feature work for this version still lives in the other tiers and in [../reasons.md](../reasons.md).

---

This build shipped **both** routine improvements and a tight cluster of **user-visible regressions / sharp edges** that justified getting fixes out quickly rather than holding them for a later train.

**What was wrong**

- [FIX] **Chat readability:** In some production bundles, chat lines inherited the wrong colour (effectively **black on dark**), making the panel hard or impossible to read.
- [FIX] **Mis-taps on blocks:** Avatar **name plates** participated in raycasts, so a plate overlapping a block could **steal** taps and right-clicks — e.g. opening a profile when you meant to interact with the world.
- [FIX] **Lobby consent row:** The Terms / Privacy agreement row could **appear too early** or fight the `hidden` attribute because layout CSS overrode display; players needed a **clear, wallet-first** disclosure before the row fades in.

**What we changed**

- Chat UI now **pins its own text colour** so it stays legible regardless of global stylesheet order.
- Name plate sprites are **excluded from block / floor picks** (same convention as other decorative children on authoritative groups).
- Lobby terms row uses an explicit **`hidden` + disclosure** path and **fade-in** so the flow matches policy: wallet (+) first, then agreement when required.

**Why now**

- **Readability and mis-clicks** are daily friction and support magnets; they do not need to wait behind unrelated features.
- **Consent UX** should be unambiguous before wallet sign-in; partial visibility undermines trust and retries.

**Residual / scope**

- Other **0.3.11** changes (profiles, streak links, player badge, ops acknowledgement paths, APIs) are unchanged in behaviour from the main tiers above — this file only highlights the **corrective** spine of the release.
