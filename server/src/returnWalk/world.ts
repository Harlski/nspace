/**
 * World adapter so Return Walk HTTP / windows do not import rooms.ts.
 */

export type ReturnWalkEligibleTile = { x: number; z: number };

export type ReturnWalkGoldTile = {
  x: number;
  z: number;
  claimable: boolean;
  kind: "goldBlock" | "returnGold";
  active: boolean;
  cooldownMs: number;
  lastClaimedAt: number;
};

export type ReturnWalkPublicRoom = {
  roomId: string;
  kind: "commons" | "public" | "playSpace" | "tutorial" | "matchPitch";
  realPresenceCount: number;
  gold: ReturnWalkGoldTile[];
};

export type ResidentPose = {
  roomId: string;
  x: number;
  z: number;
};

export type ReturnWalkWorld = {
  listPublicRooms: () => ReturnWalkPublicRoom[];
  getResidentPose: () => ResidentPose | null;
  listEligibleUpgradeTiles: (
    roomId: string,
    x: number,
    z: number
  ) => ReturnWalkEligibleTile[];
  convertTileToReturnGold: (roomId: string, x: number, z: number) => boolean;
};

let world: ReturnWalkWorld | null = null;

export function registerReturnWalkWorld(next: ReturnWalkWorld): void {
  world = next;
}

export function getReturnWalkWorld(): ReturnWalkWorld | null {
  return world;
}
