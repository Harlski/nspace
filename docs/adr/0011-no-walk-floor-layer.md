# No-Walk Floor is a parallel tile-keyed walkability layer

Authors need open-looking floor that still rejects click-to-walk (soft-blocked plazas) without
leaving holes or stacking invisible solids. **Removed base floor** removes the mesh; ordinary
blocks change silhouette. Neither matches "looks like floor, cannot walk."

**Decision:** store **No-Walk Floor** as a parallel tile-keyed set (at most a boolean per
`(x, z)`), synced on welcome/deltas, persisted with room geometry, and included in the **Build
Shell**. Floor mesh and color stay; pathfinding and walk intents treat flagged tiles as
unwalkable. Floor build mode shows a **No-Walk Floor Cue** (red X); other modes hide it. Paint
uses a No-Walk brush independent of floor color. Occupied paint is allowed; no force-move;
spawn/landing uses existing unwalkable fallbacks. Paint only on tiles that still have floor;
removing base floor clears No-Walk on that tile. ACL: owners/builders in rooms they edit;
admins anywhere except Pixel / Canvas / World Cup pitches; Hub admins only for No-Walk.

**Considered options:** reuse removed base floor — looks like a hole; invisible `passable:
false` cube — wrong silhouette and pick UX; client-only overlay — cheating / desync; fold into
`extraFloor` color — mixes recolor with walk rules.

Future readers should not treat No-Walk as obstacle stack content or as a floor color.
