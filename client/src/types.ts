export interface PlayerState {
  address: string;
  displayName: string;
  x: number;
  /** World Y (feet on floor or on block top). */
  y: number;
  z: number;
  vx: number;
  vz: number;
}
