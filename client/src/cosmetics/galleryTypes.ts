/** Wire payload for the dev-only Preset Gallery room (`cosmetic-gallery` / join code SPACER). */

export type CosmeticGallerySlot =
  | "aura"
  | "nameplate"
  | "chatBubble"
  | "trail"
  | "deployable";

export type CosmeticGalleryShowcaseWire = {
  id: string;
  presetId: string;
  label: string;
  slot: CosmeticGallerySlot;
  fakeAddress: string;
  x: number;
  z: number;
  kind: "mannequin" | "floor";
  /** Trail mannequins pace this many tiles along +X and back. */
  trailPaceTiles?: number;
  /** Stand here (south of the mannequin) to try on — gallery room only. */
  tryOnX?: number;
  tryOnZ?: number;
};

export type CosmeticGalleryWire = {
  showcases: CosmeticGalleryShowcaseWire[];
};

/** Join code for the in-world cosmetic shop (The Shaper room). */
export const COSMETIC_SHOP_JOIN_CODE = "SPACER";

/** Resolved room id of The Shaper (server `cosmetic-gallery`); used to detect arrival. */
export const COSMETIC_SHOP_ROOM_ID = "cosmetic-gallery";

/** True when a resolved room id is The Shaper. */
export function isCosmeticShopRoomId(roomId: string): boolean {
  return roomId.trim().toLowerCase() === COSMETIC_SHOP_ROOM_ID;
}
