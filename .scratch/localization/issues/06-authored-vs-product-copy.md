---
Type: grilling
Status: resolved
Blocked by: 01
---

# Terms/privacy and authored-vs-product copy boundary

## Question

Which of terms/privacy, header marquee news, advertise campaign fields, and similar sit inside Message Catalogs vs stay single-language authored content?

Agent recommendation to lock unless overridden:

- **Product chrome** around legal pages and the ack modal → catalogs.
- **Legal body** HTML → in scope only if we can ship reviewed `tr` / `pt-BR` legal text; otherwise English body for v1 with localized chrome, fog cleared by an explicit “legal translation gate” before claiming full legal i18n.
- **Admin-authored marquee news** → out of Message Catalogs (authored as-is).
- **Player-entered advertise fields** → out (user-authored).
- **Product UI on `/advertise` dashboard** → in catalogs.

## Answer

**3A locked:** legal **bodies** stay English for v1; only surrounding **product chrome** (ack modal, nav, shells) goes in Message Catalogs. Admin-authored **marquee** `newsMessages` stay authored-as-is (out of catalogs). Player-entered advertise fields out (user-authored). Product UI on `/advertise` dashboard in catalogs. Full legal-body i18n deferred behind an explicit legal translation gate (not claimed in v1).
