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
  HUB_ROOM_ID,
  HUB_TELESCOPE_ZOOM_FRUSTUM,
  HUB_TELESCOPE_ZOOM_FRUSTUM_PORTRAIT,
  getRoomBaseBounds,
} from "./roomLayouts.js";

const hubBounds = getRoomBaseBounds(HUB_ROOM_ID);
const chamberBounds = getRoomBaseBounds(CHAMBER_ROOM_ID);

describe("hub zoom limits", () => {
  const base = {
    zoomMax: 24,
    roomZoomMax: HUB_MAX_ZOOM_FRUSTUM,
    roomId: HUB_ROOM_ID,
    roomBounds: hubBounds,
    mapOverviewUnlocked: false,
    streamPresentationActive: false,
    mobilePortrait: false,
  };

  it("caps normal hub zoom at 18 even when localStorage zoomMax is higher", () => {
    expect(normalZoomMax({ ...base, telescopeHoldActive: false })).toBe(18);
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
