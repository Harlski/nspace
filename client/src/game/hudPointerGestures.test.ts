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
  HUB_ROOM_ID,
  getRoomBaseBounds,
} from "./roomLayouts.js";

function mountGame(): { game: Game; host: HTMLElement } {
  const host = document.createElement("div");
  host.style.width = "1280px";
  host.style.height = "720px";
  document.body.appendChild(host);
  const game = new Game(host);
  game.applyRoomFromWelcome({
    roomId: HUB_ROOM_ID,
    roomBounds: getRoomBaseBounds(HUB_ROOM_ID),
    doors: [],
  });
  return { game, host };
}

describe("Game.interruptHudOverlayGestures", () => {
  let host: HTMLElement | null = null;

  afterEach(() => {
    host?.remove();
    host = null;
    vi.restoreAllMocks();
  });

  it("is safe to call when no canvas gesture is active", () => {
    const mounted = mountGame();
    host = mounted.host;
    expect(() => mounted.game.interruptHudOverlayGestures()).not.toThrow();
  });
});
