# Map: Movement sync bandwidth

Label: `wayfinder:map`

## Destination

A cited bandwidth baseline for **10 / 20 / 30 concurrent players** in a click-to-walk room (per tick, per second, server egress and per-client ingress), plus a recommended movement-sync design that keeps **Path Playback** visually correct (**no rewind / teleport**) including **poor connections**, with an estimated new baseline once the recommended slices land. This effort produces **analysis and a recommendation**, not a production protocol rewrite.

## Notes

- Domain: Nimiq Space movement sync. Glossary: [CONTEXT.md](../../CONTEXT.md) (**Path Playback**, **Movement Watch**).
- Consult: [docs/THE-LARGER-SYSTEM.md](../../docs/THE-LARGER-SYSTEM.md) (room stream vs admin side channels), [docs/brainstorm/FUTURE_PROTO.md](../../docs/brainstorm/FUTURE_PROTO.md), [docs/brainstorm/movement-move-order-broadcast.md](../../docs/brainstorm/movement-move-order-broadcast.md) (PRD; Path Playback has since shipped).
- Prior diagnosis (rewind, occupied rooms): `/tmp/nspace-path-playback-rewind-handoff.md`.
- **Grill posture:** the user asked the agent to use its own recommendations. Decisions in tickets are agent-locked unless a later human overrides.
- **Execution override:** unlike default wayfinder, this map **runs measurement and method comparison in the same session** because the user asked for a written baseline vs new estimate. Production code is still out of destination unless a later ticket says otherwise.
- Do **not** fold Movement Watch into the public room stream.
- World Cup pitch **free-move** keeps velocity snapshots; click-to-walk rooms are the optimization target.

## Decisions so far

- [Measure current movement wire baseline](issues/01-measure-wire-baseline.md) — Path Playback already zeros per-tick pose; social full `state` is the remaining O(N²) cost (N=30 social hub ~4.5 MiB/min server).
- [Catalog full-state vs delta vs path-order sends](issues/02-catalog-full-state-triggers.md) — typing/pay/challenge still dump the roster; level-up already uses one-player `stateDelta`.
- [Poor-connection / no-teleport contract](research/03-poor-connection-contract.md) — analytic pose stamps; never rewind after drain; `serverNowMs` clock; ~1 Hz heartbeat not extra tick pose; `chatTyping` friends are presence deltas; `welcome` embeds in-flight `moveOrder`s.
- [Compare optimization methods with numbers](issues/04-compare-optimization-methods.md) — presence delta + omit walker pose wins; protobuf/spatial/compact keys later or skip.
- [Recommend next slices and new baseline](issues/05-recommend-next-slices.md) — ship those slices; new N=30 social hub ~0.68 MiB/min. Synthesis: [ANALYSIS.md](ANALYSIS.md).

## Not yet specified

- Binary / protobuf rollout (deferred in FUTURE_PROTO; only estimated here).
- Player-level spatial interest (terrain interest already exists; player `state` is still room-wide).

## Out of scope

- Implementing the Path Playback rewind **fix** as production code in this map (handoff said grill/TDD later; this map only accounts for it in the bandwidth + correctness recommendation).
- Movement Watch admin overlay payloads.
- Changing pathfinding, collision, or room authority.
- Extending free-move beyond field-like rooms.
