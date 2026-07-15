/**
 * ACL for painting No-Walk Floor (ADR 0011).
 * Pure flags so rooms.ts stays the adapter for room-id / admin lookups.
 */

export type NoWalkFloorPaintPolicyInput = {
  isAdmin: boolean;
  /** Owners/builders (and admins) via canEditRoomContent / invite lobby edit. */
  canEditContent: boolean;
  isHub: boolean;
  isPixel: boolean;
  isCanvas: boolean;
  isWorldCupField: boolean;
  isCosmeticGallery: boolean;
};

export function canPaintNoWalkFloor(input: NoWalkFloorPaintPolicyInput): boolean {
  if (input.isPixel || input.isCanvas || input.isWorldCupField || input.isCosmeticGallery) {
    return false;
  }
  if (input.isHub) return input.isAdmin;
  return input.canEditContent;
}
