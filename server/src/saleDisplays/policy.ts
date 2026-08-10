/**
 * ACL for placing Sale Displays (ADR 0015).
 * Pure flags so rooms.ts stays the adapter for room-id / admin lookups.
 */

export type SaleDisplayPlacePolicyInput = {
  isAdmin: boolean;
  /** True in The Shaper — Sale Displays get a carve-out without opening general Building. */
  isCosmeticGallery: boolean;
  /** Same as canPlaceBlocksInRoom for non-Shaper authorable rooms. */
  canPlaceBlocks: boolean;
};

/** Admins may place in The Shaper (carve-out) or any room where block placement is allowed. */
export function canPlaceSaleDisplay(input: SaleDisplayPlacePolicyInput): boolean {
  if (!input.isAdmin) return false;
  if (input.isCosmeticGallery) return true;
  return input.canPlaceBlocks;
}
