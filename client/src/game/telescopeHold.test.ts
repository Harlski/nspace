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
  HUB_MAX_ZOOM_FRUSTUM,
  HUB_TELESCOPE_ZOOM_FRUSTUM,
  HUB_TELESCOPE_ZOOM_FRUSTUM_PORTRAIT,
  HUB_ROOM_ID,
  CHAMBER_MAX_ZOOM_FRUSTUM,
  CHAMBER_ROOM_ID,
  getRoomBaseBounds,
} from "./roomLayouts.js";
import { MOBILE_PORTRAIT_CLASS } from "../ui/pseudoFullscreen.js";
import { createTelescopeControl } from "../ui/telescopeControl.js";
import { TELESCOPE_HOLD_ZOOM_MS } from "../telescope/constants.js";

function mountGame(): { game: Game; host: HTMLElement } {
  const host = document.createElement("div");
  host.style.width = "1280px";
  host.style.height = "720px";
  document.body.appendChild(host);
  return { game: new Game(host), host };
}

function enterCommons(game: Game): void {
  game.applyRoomFromWelcome({
    roomId: HUB_ROOM_ID,
    roomBounds: getRoomBaseBounds(HUB_ROOM_ID),
    doors: [],
  });
  game.setZoomFrustumSize(HUB_MAX_ZOOM_FRUSTUM);
}

function pointerDown(el: HTMLElement, pointerId = 1): void {
  el.dispatchEvent(
    new PointerEvent("pointerdown", {
      bubbles: true,
      button: 0,
      pointerId,
      pointerType: "mouse",
    })
  );
}

function pointerUp(el: HTMLElement, pointerId = 1): void {
  el.dispatchEvent(
    new PointerEvent("pointerup", {
      bubbles: true,
      button: 0,
      pointerId,
      pointerType: "mouse",
    })
  );
}

describe("telescope hold in commons", () => {
  let host: HTMLElement | null = null;
  let nowSpy: ReturnType<typeof vi.spyOn> | null = null;
  let virtualNow = 0;

  function startVirtualClock(): void {
    virtualNow = 1_000_000;
    nowSpy = vi.spyOn(performance, "now").mockImplementation(() => virtualNow);
  }

  function advanceMs(ms: number, game: Game): void {
    virtualNow += ms;
    game.tick(ms / 1000);
  }

  function stopVirtualClock(): void {
    nowSpy?.mockRestore();
    nowSpy = null;
  }

  afterEach(() => {
    stopVirtualClock();
    document.documentElement.classList.remove(MOBILE_PORTRAIT_CLASS);
    host?.remove();
    host = null;
    vi.restoreAllMocks();
  });

  it("tweens frustum to telescope max after hold begins", () => {
    const mounted = mountGame();
    host = mounted.host;
    const { game } = mounted;

    enterCommons(game);
    game.setTelescopeUnlocked(true);
    startVirtualClock();

    expect(game.getZoomFrustumSize()).toBeCloseTo(HUB_MAX_ZOOM_FRUSTUM, 2);

    game.beginTelescopeHold();
    expect(game.getZoomFrustumSize()).toBeCloseTo(HUB_MAX_ZOOM_FRUSTUM, 2);

    advanceMs(TELESCOPE_HOLD_ZOOM_MS, game);
    expect(game.getZoomFrustumSize()).toBeCloseTo(HUB_TELESCOPE_ZOOM_FRUSTUM, 1);
  });

  it("beginTelescopeHold widens +100% above the hub cap", () => {
    const mounted = mountGame();
    host = mounted.host;
    const { game } = mounted;

    enterCommons(game);
    game.setTelescopeUnlocked(true);
    startVirtualClock();
    game.beginTelescopeHold();
    advanceMs(TELESCOPE_HOLD_ZOOM_MS, game);

    expect(game.getZoomFrustumSize()).toBeCloseTo(HUB_TELESCOPE_ZOOM_FRUSTUM, 1);
    expect(HUB_TELESCOPE_ZOOM_FRUSTUM).toBeCloseTo(HUB_MAX_ZOOM_FRUSTUM * 2, 5);
  });

  it("beginTelescopeHold widens +100% in mobile portrait", () => {
    document.documentElement.classList.add(MOBILE_PORTRAIT_CLASS);
    const mounted = mountGame();
    host = mounted.host;
    const { game } = mounted;

    enterCommons(game);
    game.setTelescopeUnlocked(true);
    startVirtualClock();
    game.beginTelescopeHold();
    advanceMs(TELESCOPE_HOLD_ZOOM_MS, game);

    expect(game.getZoomFrustumSize()).toBeCloseTo(
      HUB_TELESCOPE_ZOOM_FRUSTUM_PORTRAIT,
      1
    );
    expect(HUB_TELESCOPE_ZOOM_FRUSTUM_PORTRAIT).toBeCloseTo(
      HUB_MAX_ZOOM_FRUSTUM * 2,
      5
    );
  });

  it("tweens frustum back to the pre-hold value on release", () => {
    const mounted = mountGame();
    host = mounted.host;
    const { game } = mounted;

    enterCommons(game);
    game.setTelescopeUnlocked(true);
    startVirtualClock();
    game.beginTelescopeHold();
    advanceMs(TELESCOPE_HOLD_ZOOM_MS, game);
    expect(game.getZoomFrustumSize()).toBeCloseTo(HUB_TELESCOPE_ZOOM_FRUSTUM, 1);

    game.endTelescopeHold();
    expect(game.getZoomFrustumSize()).toBeCloseTo(HUB_TELESCOPE_ZOOM_FRUSTUM, 1);

    advanceMs(TELESCOPE_HOLD_ZOOM_MS, game);
    expect(game.getZoomFrustumSize()).toBeCloseTo(HUB_MAX_ZOOM_FRUSTUM, 1);
  });

  it("reverses from the current frustum when released mid tween", () => {
    const mounted = mountGame();
    host = mounted.host;
    const { game } = mounted;

    enterCommons(game);
    game.setTelescopeUnlocked(true);
    startVirtualClock();
    game.beginTelescopeHold();
    advanceMs(TELESCOPE_HOLD_ZOOM_MS / 2, game);

    const midHold = game.getZoomFrustumSize();
    expect(midHold).toBeGreaterThan(HUB_MAX_ZOOM_FRUSTUM + 0.5);
    expect(midHold).toBeLessThan(HUB_TELESCOPE_ZOOM_FRUSTUM - 0.5);

    game.endTelescopeHold();
    advanceMs(TELESCOPE_HOLD_ZOOM_MS, game);
    expect(game.getZoomFrustumSize()).toBeCloseTo(HUB_MAX_ZOOM_FRUSTUM, 1);
  });

  it("re-holds during return and tweens back out from the current frustum", () => {
    const mounted = mountGame();
    host = mounted.host;
    const { game } = mounted;

    enterCommons(game);
    game.setTelescopeUnlocked(true);
    startVirtualClock();
    game.beginTelescopeHold();
    advanceMs(TELESCOPE_HOLD_ZOOM_MS, game);

    game.endTelescopeHold();
    advanceMs(TELESCOPE_HOLD_ZOOM_MS / 2, game);
    const midReturn = game.getZoomFrustumSize();
    expect(midReturn).toBeLessThan(HUB_TELESCOPE_ZOOM_FRUSTUM - 0.5);
    expect(midReturn).toBeGreaterThan(HUB_MAX_ZOOM_FRUSTUM + 0.5);

    game.beginTelescopeHold();
    advanceMs(TELESCOPE_HOLD_ZOOM_MS, game);
    expect(game.getZoomFrustumSize()).toBeCloseTo(HUB_TELESCOPE_ZOOM_FRUSTUM, 1);
  });

  it("beginTelescopeHold widens frustum in chamber (default spawn room)", () => {
    const mounted = mountGame();
    host = mounted.host;
    const { game } = mounted;

    game.applyRoomFromWelcome({
      roomId: CHAMBER_ROOM_ID,
      roomBounds: getRoomBaseBounds(CHAMBER_ROOM_ID),
      doors: [],
    });
    game.setTelescopeUnlocked(true);
    game.setZoomFrustumSize(CHAMBER_MAX_ZOOM_FRUSTUM);
    startVirtualClock();

    expect(game.getZoomFrustumSize()).toBeCloseTo(CHAMBER_MAX_ZOOM_FRUSTUM, 1);
    game.beginTelescopeHold();
    advanceMs(TELESCOPE_HOLD_ZOOM_MS, game);
    expect(game.getZoomFrustumSize()).toBeCloseTo(HUB_TELESCOPE_ZOOM_FRUSTUM, 1);

    game.endTelescopeHold();
    advanceMs(TELESCOPE_HOLD_ZOOM_MS, game);
    expect(game.getZoomFrustumSize()).toBeCloseTo(CHAMBER_MAX_ZOOM_FRUSTUM, 1);
  });

  it("UI pointer hold tweens frustum past the hub cap (main.ts wiring)", () => {
    const mounted = mountGame();
    host = mounted.host;
    const { game } = mounted;

    enterCommons(game);
    game.setTelescopeUnlocked(true);
    startVirtualClock();

    const menuHost = document.createElement("div");
    document.body.appendChild(menuHost);
    const control = createTelescopeControl(menuHost);
    control.setUnlocked(true);
    control.onHoldStart(() => game.beginTelescopeHold());
    control.onHoldEnd(() => game.endTelescopeHold());

    pointerDown(control.root);
    advanceMs(TELESCOPE_HOLD_ZOOM_MS, game);
    expect(game.getZoomFrustumSize()).toBeGreaterThan(HUB_MAX_ZOOM_FRUSTUM + 0.5);

    pointerUp(control.root);
    advanceMs(TELESCOPE_HOLD_ZOOM_MS, game);
    expect(game.getZoomFrustumSize()).toBeCloseTo(HUB_MAX_ZOOM_FRUSTUM, 1);

    menuHost.remove();
  });
});
