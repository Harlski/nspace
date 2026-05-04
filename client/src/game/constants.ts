/** Fixed 16:9 logical layout used for letterboxing and UI scaling. */
export const DESIGN_WIDTH = 1280;
export const DESIGN_HEIGHT = 720;

/** Default WebSocket room; server normalizes `lobby` to hub as well. */
export const ROOM_ID = "hub";

/** World units: one tile = 1 unit. */
export const TILE_SIZE = 1;

/** Human walk speed (world units per second). Must match server `MOVE_SPEED` in `rooms.ts`. */
export const WALK_MOVE_SPEED = 5;
/** Snap radius when approaching a path waypoint. Must match server `ARRIVE_EPS`. */
export const WALK_ARRIVE_EPS = 0.04;

/** Inclusive tile coordinate bounds: 500×500 grid. Must match server. */
export const TILE_COORD_MIN = -250;
export const TILE_COORD_MAX = 249;

/** Orthographic camera vertical extent (world units); smaller = more zoomed in. Default before user prefs. */
export const VIEW_FRUSTUM_SIZE = 6;

/** Fog of war: full visibility within this horizontal radius (XZ) from the local player. */
export const FOG_INNER_RADIUS = 10;
/** Fog ramps to opaque between inner and this outer radius (world units). */
export const FOG_OUTER_RADIUS = 22;
