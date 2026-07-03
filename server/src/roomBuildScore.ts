/** Minimum placed builds before a player-owned room may go public. */
export const MIN_BUILDS_FOR_PUBLIC = 50;

export type RoomBuildScoreParts = {
  obstacles: number;
  signboards: number;
  billboards: number;
  voxelTexts: number;
  extraFloor: number;
  baseFloorColor: number;
};

export function sumRoomBuildScore(parts: RoomBuildScoreParts): number {
  return (
    parts.obstacles +
    parts.signboards +
    parts.billboards +
    parts.voxelTexts +
    parts.extraFloor +
    parts.baseFloorColor
  );
}

export function canEnablePublicVisibility(
  score: number,
  exemptFromGate: boolean
): boolean {
  return exemptFromGate || score >= MIN_BUILDS_FOR_PUBLIC;
}

export function publicBuildGateMessage(score: number): string {
  return `Public rooms require ${MIN_BUILDS_FOR_PUBLIC} builds (${Math.max(0, score)}/${MIN_BUILDS_FOR_PUBLIC}).`;
}

export function publicBuildGateCreateMessage(): string {
  return "You must build in this room first.";
}
