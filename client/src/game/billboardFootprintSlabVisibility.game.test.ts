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
import { HUB_MAX_ZOOM_FRUSTUM, HUB_ROOM_ID, getRoomBaseBounds } from "./roomLayouts.js";
import type { BillboardState } from "../net/ws.js";
import { billboardFootprintTilesXZ } from "./billboardFootprintMath.js";

/** Matches server `BLOCK_COLOR_BILLBOARD_SLAB_RGB`. */
const BILLBOARD_SLAB_RGB = 0x9c27b0;

function mountGame(): { game: Game; host: HTMLElement } {
  const host = document.createElement("div");
  host.style.width = "1280px";
  host.style.height = "720px";
  document.body.appendChild(host);
  return { game: new Game(host), host };
}

function drainMeshBudget(game: Game): void {
  for (let i = 0; i < 40; i++) game.tick(1 / 60);
}

function footprintSlabs(
  anchorX: number,
  anchorZ: number,
  orientation: "horizontal" | "vertical",
  yawSteps: number
) {
  return billboardFootprintTilesXZ(anchorX, anchorZ, orientation, yawSteps).map(
    (t) => ({
      x: t.x,
      z: t.z,
      passable: true,
      half: true,
      colorRgb: BILLBOARD_SLAB_RGB,
    })
  );
}

function minimalBillboard(
  partial: Pick<
    BillboardState,
    "id" | "anchorX" | "anchorZ" | "orientation" | "yawSteps"
  >
): BillboardState {
  return {
    ...partial,
    slides: [],
    intervalMs: 5000,
    advertId: "",
    visitName: "",
    visitUrl: "",
    createdBy: "test",
    createdAt: 1,
  };
}

describe("billboard footprint slab visibility", () => {
  let host: HTMLElement | null = null;

  afterEach(() => {
    host?.remove();
    host = null;
  });

  it("never meshes purple footprint slabs after welcome-order obstacles then billboards", () => {
    const mounted = mountGame();
    host = mounted.host;
    Object.defineProperty(host, "clientWidth", {
      configurable: true,
      get: () => 1280,
    });
    Object.defineProperty(host, "clientHeight", {
      configurable: true,
      get: () => 720,
    });
    const { game } = mounted;

    game.applyRoomFromWelcome({
      roomId: HUB_ROOM_ID,
      roomBounds: getRoomBaseBounds(HUB_ROOM_ID),
      doors: [],
    });
    game.setZoomFrustumSize(HUB_MAX_ZOOM_FRUSTUM);
    expect(game.getBuildMode()).toBe(false);

    const anchorX = 0;
    const anchorZ = 0;
    const orientation = "horizontal" as const;
    const yawSteps = 0;
    // One footprint tile is enough; welcome still sends full slabs for all tiles.
    const slabs = footprintSlabs(anchorX, anchorZ, orientation, yawSteps).slice(
      0,
      1
    );
    expect(slabs.length).toBe(1);

    // Welcome applies obstacles before billboards (client/src/main.ts).
    game.setObstacles(slabs);
    drainMeshBudget(game);
    expect(game.getDebugStats().liveBlockMeshCount).toBe(1);

    game.setBillboards([
      minimalBillboard({
        id: "bb-1",
        anchorX,
        anchorZ,
        orientation,
        yawSteps,
      }),
    ]);
    drainMeshBudget(game);

    // Occupancy slabs stay in data but must never be live meshes (incl. build mode).
    expect(game.getDebugStats().liveBlockMeshCount).toBe(0);
    expect(game.getDebugStats().obstacleCount).toBe(1);

    game.setBuildMode(true);
    drainMeshBudget(game);
    expect(game.getDebugStats().liveBlockMeshCount).toBe(0);
  });
});
