export interface PlayerState {
  address: string;
  displayName: string;
  x: number;
  /** World Y (feet on floor or on block top). */
  y: number;
  z: number;
  vx: number;
  vz: number;
  /** Ephemeral: other tab / backgrounded or wallet-send flow (`nimSendIntent` on server). */
  nimSendAway?: boolean;
  /** Ephemeral: composing a chat message (typing indicator for others). */
  chatTyping?: boolean;
}
