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
}
