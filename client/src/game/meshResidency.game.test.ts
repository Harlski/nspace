import { describe, it, expect, afterEach, vi } from "vitest";

vi.mock("three", async (importOriginal) => {
  const THREE = await importOriginal<typeof import("three")>();
  class MockWebGLRenderer {
    domElement = document.createElement("canvas");
    setPixelRatio = vi.fn();
    setSize = vi.fn();
    setRenderTarget = vi.fn();
    render = vi.fn();
  }
  return { ...THREE, WebGLRenderer: MockWebGLRenderer };
});

import { Game } from "./Game.js";
import {
  CHAMBER_ROOM_ID,
  HUB_MAX_ZOOM_FRUSTUM,
  HUB_ROOM_ID,
  getRoomBaseBounds,
} from "./roomLayouts.js";
import { INTEREST_CHUNK_TILES } from "./interestChunks.js";

function mountGame(): { game: Game; host: HTMLElement } {
  const host = document.createElement("div");
  host.style.width = "1280px";
  host.style.height = "720px";
  document.body.appendChild(host);
  return { game: new Game(host), host };
}

describe("mesh residency in commons", () => {
  let host: HTMLElement | null = null;

  afterEach(() => {
    host?.remove();
    host = null;
  });

  it("meshes obstacles in the residency window but not far off-screen chunks", () => {
    const mounted = mountGame();
    host = mounted.host;
    Object.defineProperty(host, "clientWidth", { configurable: true, get: () => 1280 });
    Object.defineProperty(host, "clientHeight", { configurable: true, get: () => 720 });
    const { game } = mounted;

    game.applyRoomFromWelcome({
      roomId: HUB_ROOM_ID,
      roomBounds: getRoomBaseBounds(HUB_ROOM_ID),
      doors: [],
    });
    game.setZoomFrustumSize(HUB_MAX_ZOOM_FRUSTUM);

    const far = INTEREST_CHUNK_TILES * 8;
    game.setObstacles([
      { x: 0, z: 0, passable: false, colorRgb: 0x112233 },
      { x: 1, z: 0, passable: false, colorRgb: 0x112233 },
      { x: far, z: far, passable: false, colorRgb: 0x445566 },
    ]);

    // Drain budgeted builds for the resident window.
    for (let i = 0; i < 40; i++) game.tick(1 / 60);

    const stats = game.getDebugStats();
    expect(stats.obstacleCount).toBe(3);
    expect(stats.meshResidentChunkCount).toBeGreaterThan(0);
    expect(stats.meshResidentChunkCount).toBeLessThan(20);

    // Far obstacle remains in data (obstacleCount) but should not keep the
    // resident set huge; pending queue should finish for on-screen tiles.
    expect(stats.meshBuildPendingCount).toBe(0);
    // Near tiles meshed; far chunk left as data only.
    expect(stats.liveBlockMeshCount).toBe(2);
    expect(stats.liveBlockMeshCount).toBeLessThan(stats.obstacleCount);
  });

  it("drops Commons floor meshes when entering Hub (chamber)", () => {
    const mounted = mountGame();
    host = mounted.host;
    Object.defineProperty(host, "clientWidth", { configurable: true, get: () => 1280 });
    Object.defineProperty(host, "clientHeight", { configurable: true, get: () => 720 });
    const { game } = mounted;

    game.applyRoomFromWelcome({
      roomId: HUB_ROOM_ID,
      roomBounds: getRoomBaseBounds(HUB_ROOM_ID),
      doors: [],
    });
    game.setZoomFrustumSize(HUB_MAX_ZOOM_FRUSTUM);
    for (let i = 0; i < 10; i++) game.tick(1 / 60);

    const commonsFloors = game.getDebugStats().walkableFloorMeshCount;
    // Commons is 25×25 in one residency chunk; all base tiles should be live.
    expect(commonsFloors).toBe(25 * 25);

    game.applyRoomFromWelcome({
      roomId: CHAMBER_ROOM_ID,
      roomBounds: getRoomBaseBounds(CHAMBER_ROOM_ID),
      doors: [],
    });
    for (let i = 0; i < 10; i++) game.tick(1 / 60);

    const hubFloors = game.getDebugStats().walkableFloorMeshCount;
    expect(hubFloors).toBe(13 * 13);
    expect(hubFloors).toBeLessThan(commonsFloors);
  });
});
