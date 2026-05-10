# Hotfix release notes (`0.3.9`)

**Audience:** anyone reading `/patchnotes` during an **urgent corrective** release — what was wrong, what was patched, and why we shipped quickly.  
**Depth:** short, factual; not a substitute for `reasons.md` or the normal Brief → Developers tiers (those stay the default “what shipped” story).

---

- **What slipped:** After **idle render gating**, we trimmed full scene redraws when nothing seemed to move. **`updateMineableBlockSparkles()`** (particle shell, rotation, opacity, emissive pulse on claimable blocks) was tied to the same “visual activity” flag as general motion—so when the room went idle, those updates and renders **stopped** too. We did not intend claimable block shine to freeze.
- **What we shipped:** Claimable blocks now **always drive** sparkle updates whenever that VFX exists, and they **keep a short render window** so the effect stays alive even if avatars and paths are still.
- **Why now:** Small, low-risk client-only fix; restores the expected “living” cue for active minable blocks without turning idle performance work back into continuous full scene renders for the whole room.
