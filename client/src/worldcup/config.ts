/**
 * World Cup soccer feature — client config (FEATURE-FLAGGED, DEPRECATABLE).
 *
 * Client-only UI gating (the build-dock Ball prop, scoreboard auto-show). Ball
 * rendering itself runs whenever the server sends `ballState`, so most behavior is
 * server-driven and this flag mainly hides authoring affordances when off.
 *
 * To deprecate: set VITE_WORLDCUP_ENABLED=0, later delete client/src/worldcup/ and
 * the few `worldcup`-tagged hooks in Game.ts / main.ts / ws.ts.
 */

function envFlag(raw: unknown, defaultOn: boolean): boolean {
  const s = String(raw ?? "").trim().toLowerCase();
  if (s === "") return defaultOn;
  return !(s === "0" || s === "false" || s === "off" || s === "no");
}

/** Master switch (build-time). On by default; set VITE_WORLDCUP_ENABLED=0 to disable. */
export const WORLDCUP_ENABLED = envFlag(
  import.meta.env.VITE_WORLDCUP_ENABLED,
  true
);

/** Standalone soccer field room id (must match server `FIELD_ROOM_ID`). */
export const FIELD_ROOM_ID = "field";

/** Ephemeral 1v1 Match Pitch room-id prefix (must match server `MATCH_PITCH_PREFIX`). */
export const MATCH_PITCH_PREFIX = "wc-match-";

/** True for any ephemeral Match Pitch room (reuses the field's pitch visuals + free move). */
export function isMatchPitchRoomId(roomId: string | null | undefined): boolean {
  return typeof roomId === "string" && roomId.startsWith(MATCH_PITCH_PREFIX);
}

/** True for the Free Play Field or any Match Pitch (field-like pitch visuals + free movement). */
export function isFieldLikeRoomId(roomId: string | null | undefined): boolean {
  return roomId === FIELD_ROOM_ID || isMatchPitchRoomId(roomId);
}

/** Soccer pitch bounds — must match server `FIELD_BOUNDS`. */
export const FIELD_BOUNDS = { minX: -10, maxX: 10, minZ: -7, maxZ: 7 } as const;

/**
 * How far (world units) a player may step past the pitch edges so they can get fully behind a
 * ball pinned against a wall. Must match the server `WORLDCUP_FIELD_OUTFIELD_MARGIN` default;
 * ball walls stay at the true bounds, only player movement is widened.
 */
export const FIELD_OUTFIELD_MARGIN = 1.0;

/** Hub west-edge door to the field — must match server `HUB_FIELD_DOOR`. */
export const HUB_FIELD_DOOR = {
  x: -12,
  z: 6,
  targetRoomId: FIELD_ROOM_ID,
  spawnX: -8,
  spawnZ: 6,
} as const;

/** Field west-edge door back to the hub — must match server `FIELD_HUB_DOOR`. */
export const FIELD_HUB_DOOR = {
  x: -10,
  z: 6,
  targetRoomId: "hub",
  spawnX: -11,
  spawnZ: 6,
} as const;

/** Goal mouths (tile rects) — must match server `FIELD_GOALS`. Used for rendering posts. */
export const FIELD_GOALS = [
  { id: "west", minX: -10, maxX: -9, minZ: -2, maxZ: 2 },
  { id: "east", minX: 9, maxX: 10, minZ: -2, maxZ: 2 },
] as const;

/** ISO 3166-1 alpha-2 code -> { name, flag emoji }. Used by the country picker. */
export type CountryInfo = { code: string; name: string; flag: string };
