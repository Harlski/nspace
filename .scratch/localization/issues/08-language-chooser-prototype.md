---
Type: prototype
Status: resolved
Blocked by: 03, 05
---

# Player Menu language chooser tracer

## Question

Does a minimal Player Menu **Language** row + chooser (three Supported Locales, named in their own language) feel correct for v1, and does immediate apply without full reload feel acceptable on one small surface?

Throwaway prototype: stub catalogs for a handful of Player Menu labels + one confirm string; wire preference + `lang` attribute; no production merge. Link the prototype artifact from the answer. Use this to validate placement and apply semantics before `/to-spec`.

## Answer

**Skip throwaway prototype.** The production Player Menu **Language** row (three Supported Locales, named in their own language, immediate apply per [05](05-locale-apply-semantics.md)) is the tracer bullet for placement and apply semantics; validate in the real client during implementation rather than a disposable stub.
