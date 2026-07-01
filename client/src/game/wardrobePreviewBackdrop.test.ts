import { describe, expect, it } from "vitest";
import {
  buildWardrobePreviewFloorPatch,
  collectWardrobePreviewBlocksInPatch,
  getRoomDefaultSpawnTile,
  resolveWardrobePreviewAnchorTile,
  roomSceneBackgroundToRgb,
  rotateWardrobePreviewViewOffsetToWorld,
  shouldRenderWardrobePreviewBlock,
  snapWardrobePreviewCameraOrbitYaw,
  TERRAIN_TILE_CORE_COLOR,
  TERRAIN_WATER_COLOR,
  wardrobePreviewBlockOccludesAvatar,
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
  it("returns a 5×5 view grid with the anchor tile at local (0, 0)", () => {
    const patch = buildWardrobePreviewFloorPatch(5, 10, ctx());
    expect(patch).toHaveLength(25);
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

  it("extends three rows behind the avatar and one row toward the camera", () => {
    const patch = buildWardrobePreviewFloorPatch(0, 0, ctx());
    expect(patch.some((c) => c.localX === 0 && c.localZ === -3)).toBe(true);
    expect(patch.some((c) => c.localX === 0 && c.localZ === -2)).toBe(true);
    expect(patch.some((c) => c.localX === 0 && c.localZ === 1)).toBe(true);
    expect(patch.some((c) => c.localX === -2 && c.localZ === 0)).toBe(true);
    expect(patch.some((c) => c.localX === 2 && c.localZ === 0)).toBe(true);
    expect(patch.some((c) => c.localX === -3 && c.localZ === 0)).toBe(false);
  });

  it("glows door tiles with portal cyan", () => {
    const patch = buildWardrobePreviewFloorPatch(12, 0, ctx({
      doorTileKeys: new Set(["12,0"]),
    }));
    const door = patch.find((c) => c.localX === 0 && c.localZ === 0);
    expect(door?.colorRgb).toBe(0x06b6d4);
  });

  it("rotates world sampling when the capture camera corner is not yaw 0", () => {
    const yaw = Math.PI / 2;
    const patch = buildWardrobePreviewFloorPatch(5, 10, ctx(), yaw);
    const behind = patch.find((c) => c.localX === 0 && c.localZ === -2);
    expect(behind).toMatchObject({ worldX: 3, worldZ: 10 });
    const { dx, dz } = rotateWardrobePreviewViewOffsetToWorld(0, -2, yaw);
    expect(behind).toMatchObject({ worldX: 5 + dx, worldZ: 10 + dz });
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

describe("snapWardrobePreviewCameraOrbitYaw", () => {
  it("snaps to the nearest isometric corner", () => {
    expect(snapWardrobePreviewCameraOrbitYaw(0)).toBe(0);
    expect(snapWardrobePreviewCameraOrbitYaw(0.9)).toBe(Math.PI / 2);
    expect(snapWardrobePreviewCameraOrbitYaw(Math.PI)).toBe(Math.PI);
  });
});

describe("collectWardrobePreviewBlocksInPatch", () => {
  it("collects only blocks inside the 4×4 patch", () => {
    const blocks = collectWardrobePreviewBlocksInPatch(5, 5, [
      "2,5,0",
      "3,5,0",
      "4,5,0",
      "4,4,0",
      "5,5,1",
      "5,5,2",
      "6,5,0",
      "7,5,0",
      "8,5,0",
      "5,6,0",
    ]);
    expect(blocks.map((b) => b.blockKey).sort()).toEqual([
      "3,5,0",
      "4,4,0",
      "4,5,0",
      "5,5,1",
      "5,5,2",
      "5,6,0",
      "6,5,0",
      "7,5,0",
    ]);
  });

  it("collects every stack level on the same tile", () => {
    const blocks = collectWardrobePreviewBlocksInPatch(0, 0, [
      "1,0,0",
      "1,0,1",
      "1,0,2",
    ]);
    expect(blocks.map((b) => `${b.worldX},${b.worldZ},${b.yLevel}`).sort()).toEqual([
      "1,0,0",
      "1,0,1",
      "1,0,2",
    ]);
  });

  it("maps world blocks into view-local slots for the capture camera corner", () => {
    const yaw = Math.PI / 2;
    const blocks = collectWardrobePreviewBlocksInPatch(5, 10, ["3,10,0"], yaw);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      localX: 0,
      localZ: -2,
      worldX: 3,
      worldZ: 10,
      blockKey: "3,10,0",
    });
  });
});

describe("wardrobePreviewBlockOccludesAvatar", () => {
  it("treats the avatar tile as occluding", () => {
    expect(wardrobePreviewBlockOccludesAvatar({ worldDx: 0, worldDz: 0 })).toBe(
      true
    );
  });

  it("drops camera-side tiles and keeps background tiles", () => {
    expect(shouldRenderWardrobePreviewBlock({ worldDx: 1, worldDz: 1 })).toBe(
      false
    );
    expect(shouldRenderWardrobePreviewBlock({ worldDx: -2, worldDz: -1 })).toBe(
      true
    );
  });
});
