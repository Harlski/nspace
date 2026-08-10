/** Wire types for in-world Sale Displays (CONTEXT.md / ADR 0015). */

export type SaleDisplaySlot =
  | "aura"
  | "nameplate"
  | "chatBubble"
  | "trail"
  | "deployable";

export type SaleDisplayWire = {
  id: string;
  x: number;
  z: number;
  cosmeticSku: string | null;
  presetId?: string;
  label?: string;
  slot?: SaleDisplaySlot;
  kind?: "mannequin" | "floor";
  /** Admin-only: sku set but not player-visible. */
  bindInactive?: boolean;
};
