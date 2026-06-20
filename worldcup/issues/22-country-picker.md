---
id: "22-country-picker"
milestone: M2
depends_on: ["21-goal-detection"]
status: todo
acceptance:
  - client/src/worldcup/countries.ts: full ISO 3166-1 list with flag emoji
  - countryPickerModal.ts: searchable modal (reuses usernamePromptModal overlay pattern)
  - sendSetCountry helper; picker opens from a flag button and auto-opens on first uncredited goal
  - Selected country persists (server) and is reflected on reconnect via welcome.selfCountry
verify:
  - "npm run build"
  - "Manual: pick a country once; later goals auto-tally to it"
---

# 22 — Country picker

Searchable flag picker. Player chooses once; the choice is persisted server-side and
applied to all future goals. A flag button lets them change it anytime.
