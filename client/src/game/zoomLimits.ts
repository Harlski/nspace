import {
  CHAMBER_MAX_ZOOM_FRUSTUM,
  CHAMBER_ROOM_ID,
  CHAMBER_TELESCOPE_ZOOM_FRUSTUM,
  CHAMBER_TELESCOPE_ZOOM_FRUSTUM_PORTRAIT,
  HUB_MAX_ZOOM_FRUSTUM,
  HUB_ROOM_ID,
  HUB_TELESCOPE_ZOOM_FRUSTUM,
  HUB_TELESCOPE_ZOOM_FRUSTUM_PORTRAIT,
  TELESCOPE_PORTRAIT_ZOOM_MULTIPLIER,
  normalizeRoomId,
  type RoomBounds,
} from "./roomLayouts.js";
import {
  NON_ADMIN_MAX_ZOOM_FRUSTUM,
  roomUsesSpatialInterest,
} from "./interestChunks.js";

export function roomFrustumCap(roomId: string): number | null {
  const id = normalizeRoomId(roomId);
  if (id === HUB_ROOM_ID) return HUB_MAX_ZOOM_FRUSTUM;
  if (id === CHAMBER_ROOM_ID) return CHAMBER_MAX_ZOOM_FRUSTUM;
  return null;
}

function telescopeFrustumForRoom(
  roomId: string,
  mobilePortrait: boolean
): number | null {
  const id = normalizeRoomId(roomId);
  if (id === HUB_ROOM_ID) {
    return mobilePortrait
      ? HUB_TELESCOPE_ZOOM_FRUSTUM_PORTRAIT
      : HUB_TELESCOPE_ZOOM_FRUSTUM;
  }
  if (id === CHAMBER_ROOM_ID) {
    return mobilePortrait
      ? CHAMBER_TELESCOPE_ZOOM_FRUSTUM_PORTRAIT
      : CHAMBER_TELESCOPE_ZOOM_FRUSTUM;
  }
  return null;
}

export type ZoomLimitContext = {
  zoomMax: number;
  roomZoomMax: number;
  roomId: string;
  roomBounds: RoomBounds;
  mapOverviewUnlocked: boolean;
  streamPresentationActive: boolean;
  telescopeHoldActive: boolean;
  /** Mobile portrait (Pay / mobile-play host) - wider Telescope hold (+100% vs normal cap). */
  mobilePortrait: boolean;
};

/** Max zoom-out without Telescope (room caps beat persisted zoomMax). */
export function normalZoomMax(ctx: ZoomLimitContext): number {
  let max = Math.max(ctx.zoomMax, ctx.roomZoomMax);
  // Hub/chamber hard caps apply to players; admins (map overview unlocked) keep their
  // custom Max frustum from the admin camera panel.
  if (!ctx.mapOverviewUnlocked) {
    const cap = roomFrustumCap(ctx.roomId);
    if (cap != null) max = Math.min(max, cap);
  }
  if (
    !ctx.mapOverviewUnlocked &&
    !ctx.streamPresentationActive &&
    roomUsesSpatialInterest(ctx.roomBounds)
  ) {
    max = Math.min(max, NON_ADMIN_MAX_ZOOM_FRUSTUM);
  }
  return max;
}

export function telescopeHoldZoomCeiling(ctx: ZoomLimitContext): number | null {
  if (!ctx.telescopeHoldActive) return null;
  return telescopeFrustumForRoom(ctx.roomId, ctx.mobilePortrait);
}

export function effectiveZoomMax(ctx: ZoomLimitContext): number {
  let max = normalZoomMax(ctx);
  const tele = telescopeHoldZoomCeiling(ctx);
  if (tele != null) max = Math.max(max, tele);
  return max;
}

/** Frustum to animate toward while Telescope is held (null = no extra zoom in this room). */
export function telescopeHoldTargetFrustum(
  ctx: Omit<ZoomLimitContext, "telescopeHoldActive">
): number | null {
  const builtin = telescopeFrustumForRoom(ctx.roomId, ctx.mobilePortrait);
  if (builtin != null) return builtin;
  if (roomUsesSpatialInterest(ctx.roomBounds)) {
    const base = Math.max(ctx.zoomMax, ctx.roomZoomMax);
    return ctx.mobilePortrait ? base * TELESCOPE_PORTRAIT_ZOOM_MULTIPLIER : base;
  }
  return null;
}

/** True when this room supports widening beyond the normal cap while Telescope is held. */
export function roomSupportsTelescopeBoost(
  ctx: Omit<ZoomLimitContext, "telescopeHoldActive">
): boolean {
  const target = telescopeHoldTargetFrustum(ctx);
  if (target == null) return false;
  const normalMax = normalZoomMax({ ...ctx, telescopeHoldActive: false });
  return target > normalMax + 0.05;
}

/** True when hold should widen the view beyond the normal room cap. */
export function telescopeHoldWouldWiden(
  ctx: Omit<ZoomLimitContext, "telescopeHoldActive">,
  frustumSize: number
): boolean {
  if (!roomSupportsTelescopeBoost(ctx)) return false;
  const target = telescopeHoldTargetFrustum(ctx)!;
  return frustumSize < target - 0.05;
}
