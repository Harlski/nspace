/** Stand-to-buy pad: one floor tile in front of a Sale Display (+Z). */

export const SALE_DISPLAY_BUY_PAD_OFFSET = { dx: 0, dz: 1 } as const;

export function saleDisplayBuyPadTile(
  displayX: number,
  displayZ: number
): { x: number; z: number } {
  return {
    x: displayX + SALE_DISPLAY_BUY_PAD_OFFSET.dx,
    z: displayZ + SALE_DISPLAY_BUY_PAD_OFFSET.dz,
  };
}

export function isStandingOnSaleDisplayBuyPad(
  standX: number,
  standZ: number,
  displayX: number,
  displayZ: number
): boolean {
  const pad = saleDisplayBuyPadTile(displayX, displayZ);
  return standX === pad.x && standZ === pad.z;
}
