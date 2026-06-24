export interface PlayerState {
  address: string;
  displayName: string;
  x: number;
  /** World Y (feet on floor or on block top). */
  y: number;
  z: number;
  vx: number;
  vz: number;
  /** Prior display names (newest first), from server profile store. */
  recentAliases?: string[];
  /** From server room snapshot when that client connected via Nimiq Pay mini-app. */
  nimiqPay?: boolean;
  /** Ephemeral: other tab / backgrounded or wallet-send flow (`nimSendIntent` on server). */
  nimSendAway?: boolean;
  /** Ephemeral: composing a chat message (typing indicator for others). */
  chatTyping?: boolean;
  /** worldcup: this player has an open 1v1 Challenge floating above them (click to accept). */
  challengeOpen?: boolean;
  /** worldcup: this player's chosen country (ISO alpha-2), so the field crowd can wave their flag. */
  worldcupCountry?: string | null;
  /** Equipped passive cosmetic preset ids from server loadout. */
  cosmeticAura?: string | null;
  cosmeticNameplate?: string | null;
  cosmeticChatBubble?: string | null;
  cosmeticTrail?: string | null;
}
