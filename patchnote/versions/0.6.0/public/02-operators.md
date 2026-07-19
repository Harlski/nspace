# Public patch notes — operators (`0.6.0`)

**Audience:** self-hosters, deployers, infra — Docker, env vars, migrations, breaking ops changes.  
**Depth:** concrete steps, new/removed variables, compose profiles, backup/restart expectations.

---

- [OPS] **Nimiq Pay tutorial off by default** — set `TUTORIAL_ENABLED=1` and enable under `/admin/settings` to route new/incomplete Pay wallets into Tutorial Room. Related: `TUTORIAL_BUILDER_ALLOWLIST`, `TUTORIAL_FAUCET_AMOUNT_LUNA`, `TUTORIAL_DOOR_AMOUNT_LUNA`, `TUTORIAL_DOOR_RECIPIENT`; client build may set `VITE_TUTORIAL_ESCAPE_MS` / `VITE_TUTORIAL_ESCAPE_COUNTDOWN_MS`. Admins can still teleporter into Tutorial Room while it is off, and use Reset / Start over there even after completing.
- [OPS] **Tutorial Template layout** — default bootstrap is the portrait Tutorial Path (7×15: Mine south → Unlock Pad → Exit north). Deploys that already persisted a tutorial template keep the old layout until you republish from Tutorial Staging (or remove the stored template so bootstrap recreates the default).
- [OPS] **Unlock Pad + Payment Intent** — non-tutorial pads need a configured Payment Intent service with feature kind `nspace.unlock_pad`. Bump game server and payment-intent-service together for that handler.
- [OPS] **Room geometry** — No-Walk Floor (`noWalkFloor`) and Attention Markers (`attentionMarkers`, including size percent) persist in room JSON and Build Shells; republish staging templates after editing.
- [NEW] **Mining Restriction** — from profile Actions or `/admin/moderation`, ban a wallet from claimable-block NIM mining. Queued block-claim payouts stay held (not sent on-chain) until the restriction is lifted; maze / World Cup / feedback payouts are unaffected.
