import { describe, expect, it } from "vitest";
import {
  buildWardrobePreviewFloorPatch,
  getRoomDefaultSpawnTile,
  resolveWardrobePreviewAnchorTile,
  roomSceneBackgroundToRgb,
  TERRAIN_TILE_CORE_COLOR,
  TERRAIN_WATER_COLOR,
  type WardrobePreviewFloorContext,
} from "./wardrobePreviewBackdrop.js";
import { CHAMBER_DEFAULT_SPAWN, HUB_ROOM_ID, PIXEL_DEFAULT_SPAWN } from "./roomLayouts.js";

function ctx(
  overrides: Partial<WardrobePreviewFloorContext> = {}
): WardrobePreviewFloorContext {
  return {
    roomId: HUB_ROOM_ID,
    extraFloorKeys: new Set(),
    extraFloorColorByKey: new Map(),
    baseFloorColorByKey: new Map(),
    removedBaseFloorKeys: new Set(),
    doorTileKeys: new Set(),
    ...overrides,
  };
}

describe("resolveWardrobePreviewAnchorTile", () => {
  it("uses floored self position when available", () => {
    expect(
      resolveWardrobePreviewAnchorTile(
        { x: 3.7, z: -1.2 },
        { x: 0, z: 0 }
      )
    ).toEqual({ x: 3, z: -2 });
  });

  it("falls back to room spawn when self position is missing", () => {
    expect(
      resolveWardrobePreviewAnchorTile(null, getRoomDefaultSpawnTile(HUB_ROOM_ID))
    ).toEqual(getRoomDefaultSpawnTile(HUB_ROOM_ID));
  });
});

describe("buildWardrobePreviewFloorPatch", () => {
  it("returns a 3×3 grid centered on the anchor with avatar on the middle tile", () => {
    const patch = buildWardrobePreviewFloorPatch(5, 10, ctx());
    expect(patch).toHaveLength(9);
    const center = patch.find((c) => c.localX === 0 && c.localZ === 0);
    expect(center).toMatchObject({ worldX: 5, worldZ: 10, walkable: true });
  });

  it("renders non-walkable cells as void water", () => {
    const patch = buildWardrobePreviewFloorPatch(-12, -12, ctx({ roomId: HUB_ROOM_ID }));
    const corner = patch.find((c) => c.localX === -1 && c.localZ === -1);
    expect(corner?.walkable).toBe(false);
    expect(corner?.colorRgb).toBe(TERRAIN_WATER_COLOR);
  });

  it("uses painted base floor colors on walkable tiles", () => {
    const patch = buildWardrobePreviewFloorPatch(0, 0, ctx({
      baseFloorColorByKey: new Map([["0,0", 0xff00aa]]),
    }));
    const center = patch.find((c) => c.localX === 0 && c.localZ === 0);
    expect(center?.walkable).toBe(true);
    expect(center?.colorRgb).toBe(0xff00aa);
  });

  it("uses default core color when no paint is set", () => {
    const patch = buildWardrobePreviewFloorPatch(0, 0, ctx());
    const center = patch.find((c) => c.localX === 0 && c.localZ === 0);
    expect(center?.colorRgb).toBe(TERRAIN_TILE_CORE_COLOR);
  });

  it("glows door tiles with portal cyan", () => {
    const patch = buildWardrobePreviewFloorPatch(12, 0, ctx({
      doorTileKeys: new Set(["12,0"]),
    }));
    const door = patch.find((c) => c.localX === 0 && c.localZ === 0);
    expect(door?.colorRgb).toBe(0x06b6d4);
  });
});

describe("getRoomDefaultSpawnTile", () => {
  it("returns chamber default spawn", () => {
    expect(getRoomDefaultSpawnTile("chamber")).toEqual(CHAMBER_DEFAULT_SPAWN);
  });

  it("returns pixel default spawn", () => {
    expect(getRoomDefaultSpawnTile("pixel")).toEqual(PIXEL_DEFAULT_SPAWN);
  });
});

describe("roomSceneBackgroundToRgb", () => {
  it("maps neutrals and hue like the in-world room sky", () => {
    expect(roomSceneBackgroundToRgb({ neutral: "black" })).toBe(0x070a0f);
    expect(roomSceneBackgroundToRgb({ hueDeg: 120 })).toBeGreaterThan(0);
    expect(roomSceneBackgroundToRgb({ hueDeg: null, neutral: null })).toBe(
      TERRAIN_WATER_COLOR
    );
  });
});
