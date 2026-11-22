import { describe, it, expect } from "vitest";
import {
  effectiveZoomMax,
  normalZoomMax,
  roomSupportsTelescopeBoost,
  telescopeHoldWouldWiden,
} from "./zoomLimits.js";
import {
  CHAMBER_MAX_ZOOM_FRUSTUM,
  CHAMBER_ROOM_ID,
  HUB_MAX_ZOOM_FRUSTUM,
  PUBLIC_DIRECTORY_ROOM_ID,
  HUB_ROOM_ID,
  HUB_TELESCOPE_ZOOM_FRUSTUM,
  HUB_TELESCOPE_ZOOM_FRUSTUM_PORTRAIT,
  PLAYER_ROOM_MAX_ZOOM_FRUSTUM,
  getRoomBaseBounds,
} from "./roomLayouts.js";

const hubBounds = getRoomBaseBounds(HUB_ROOM_ID);
const chamberBounds = getRoomBaseBounds(CHAMBER_ROOM_ID);

describe("hub zoom limits", () => {
  const base = {
    zoomMax: 40,
    roomZoomMax: HUB_MAX_ZOOM_FRUSTUM,
    roomId: HUB_ROOM_ID,
    roomBounds: hubBounds,
    mapOverviewUnlocked: false,
    streamPresentationActive: false,
    mobilePortrait: false,
  };

  it("caps normal hub zoom at HUB_MAX_ZOOM_FRUSTUM even when localStorage zoomMax is higher", () => {
    expect(normalZoomMax({ ...base, telescopeHoldActive: false })).toBe(
      HUB_MAX_ZOOM_FRUSTUM
    );
  });

  it("lets admin map-overview unlock bypass the hub frustum cap", () => {
    expect(
      normalZoomMax({
        ...base,
        mapOverviewUnlocked: true,
        telescopeHoldActive: false,
      })
    ).toBe(40);
  });

  it("raises effective max to telescope frustum while held", () => {
    expect(
      effectiveZoomMax({ ...base, telescopeHoldActive: true })
    ).toBe(HUB_TELESCOPE_ZOOM_FRUSTUM);
  });

  it("raises effective max +100% in mobile portrait while held", () => {
    expect(
      effectiveZoomMax({
        ...base,
        mobilePortrait: true,
        telescopeHoldActive: true,
      })
    ).toBe(HUB_TELESCOPE_ZOOM_FRUSTUM_PORTRAIT);
  });

  it("raises effective max to telescope frustum while held in chamber", () => {
    expect(
      effectiveZoomMax({
        zoomMax: 24,
        roomZoomMax: CHAMBER_MAX_ZOOM_FRUSTUM,
        roomId: CHAMBER_ROOM_ID,
        roomBounds: chamberBounds,
        mapOverviewUnlocked: false,
        streamPresentationActive: false,
        mobilePortrait: false,
        telescopeHoldActive: true,
      })
    ).toBe(HUB_TELESCOPE_ZOOM_FRUSTUM);
  });

  it("detects when hold would widen from the normal cap", () => {
    expect(roomSupportsTelescopeBoost(base)).toBe(true);
    expect(telescopeHoldWouldWiden(base, HUB_MAX_ZOOM_FRUSTUM)).toBe(true);
    expect(telescopeHoldWouldWiden(base, HUB_TELESCOPE_ZOOM_FRUSTUM)).toBe(
      false
    );
  });

  it("keeps Public Rooms on the Hub frustum when the hall is long", () => {
    expect(
      normalZoomMax({
        zoomMax: 80,
        roomZoomMax: 67.63,
        roomId: PUBLIC_DIRECTORY_ROOM_ID,
        roomBounds: { minX: -6, maxX: 6, minZ: -2, maxZ: 63 },
        mapOverviewUnlocked: false,
        streamPresentationActive: false,
        mobilePortrait: false,
        telescopeHoldActive: false,
      })
    ).toBe(HUB_MAX_ZOOM_FRUSTUM);
  });

  it("caps player rooms at 18.7 even when the floor is wide", () => {
    expect(
      normalZoomMax({
        zoomMax: 80,
        roomZoomMax: 67,
        roomId: "ab12cd",
        roomBounds: { minX: -33, maxX: 33, minZ: -33, maxZ: 33 },
        mapOverviewUnlocked: false,
        streamPresentationActive: false,
        mobilePortrait: false,
        telescopeHoldActive: false,
      })
    ).toBe(PLAYER_ROOM_MAX_ZOOM_FRUSTUM);
  });

  it("does not offer boost when normal max already equals telescope target", () => {
    const uncapped = {
      ...base,
      roomId: "pixel",
      roomBounds: { minX: -250, maxX: 249, minZ: -250, maxZ: 249 },
      mapOverviewUnlocked: true,
      zoomMax: 24,
      roomZoomMax: 24,
      mobilePortrait: false,
    };
    expect(roomSupportsTelescopeBoost(uncapped)).toBe(false);
  });
});
