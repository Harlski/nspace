import type { TerrainProps } from "../grid.js";
import {
  ackTutorialDoorSent,
  buildTutorialWelcomePayload,
  canClaimTutorialMineSlot,
  completeTutorial,
  computeNeedsTutorial,
  evaluateTutorialRoomJoin,
  getTutorialFaucetRewardLuna,
  isTutorialGatePassableForWallet,
  isTutorialMineAlreadyClaimed,
  markTutorialMineComplete,
  shouldBypassTutorialFaucetBalancePeek,
  tutorialFaucetClaimId,
  type TutorialWelcome,
} from "../tutorialSessionService.js";
import {
  isTutorialFeatureEnabled,
  isTutorialRoomHiddenFromCatalog,
  isTutorialRuntimeRoomId,
  isTutorialStagingRoomId,
  TUTORIAL_ROOM_ID,
} from "./config.js";
import {
  CHAMBER_DEFAULT_SPAWN,
  CHAMBER_ROOM_ID,
  type DoorDef,
} from "../roomLayouts.js";
import { fireAchievementEvent } from "../achievementStore.js";
import { getTutorialProfileRow } from "../playerProfileStore.js";

export function tutorialRoomHiddenFromCatalog(roomId: string): boolean {
  return isTutorialRoomHiddenFromCatalog(roomId);
}

/** Virtual Hub exit door north of the Unlock Pad once Pay ack / escape unlocks it. */
export function findTutorialHubExitDoor(opts: {
  roomId: string;
  wallet: string;
  placed: ReadonlyMap<
    string,
    {
      gate?: { exitX: number; exitZ: number };
      unlockPad?: { instanceId?: string };
    }
  >;
}): DoorDef | null {
  if (!isTutorialRuntimeRoomId(opts.roomId)) return null;
  if (!isTutorialGatePassableForWallet(opts.wallet)) return null;
  for (const [k, v] of opts.placed) {
    if (v.unlockPad) {
      const parts = k.split(",").map(Number);
      if (
        parts.length < 2 ||
        !Number.isFinite(parts[0]) ||
        !Number.isFinite(parts[1])
      ) {
        continue;
      }
      const x = Math.floor(parts[0]!);
      const z = Math.floor(parts[1]!);
      return {
        x,
        z: z + 1,
        targetRoomId: CHAMBER_ROOM_ID,
        spawnX: CHAMBER_DEFAULT_SPAWN.x,
        spawnZ: CHAMBER_DEFAULT_SPAWN.z,
      };
    }
  }
  for (const v of opts.placed.values()) {
    if (!v.gate) continue;
    return {
      x: v.gate.exitX,
      z: v.gate.exitZ,
      targetRoomId: CHAMBER_ROOM_ID,
      spawnX: CHAMBER_DEFAULT_SPAWN.x,
      spawnZ: CHAMBER_DEFAULT_SPAWN.z,
    };
  }
  return null;
}

export function doorsForWelcomeWithTutorialExit(
  roomId: string,
  wallet: string,
  baseDoors: readonly DoorDef[],
  placed: ReadonlyMap<string, { gate?: { exitX: number; exitZ: number } }>
): DoorDef[] {
  const doors = [...baseDoors];
  const exit = findTutorialHubExitDoor({ roomId, wallet, placed });
  if (
    exit &&
    !doors.some((d) => d.x === exit.x && d.z === exit.z)
  ) {
    doors.push(exit);
  }
  return doors;
}

export function buildTutorialWelcomeForConn(opts: {
  wallet: string;
  roomId: string;
  sessionNimiqPay: boolean;
  viaTeleporter?: boolean;
  listMineSlots: () => string[];
}): TutorialWelcome | undefined {
  if (!isTutorialFeatureEnabled()) return undefined;
  return buildTutorialWelcomePayload({
    wallet: opts.wallet,
    roomId: opts.roomId,
    sessionNimiqPay: opts.sessionNimiqPay,
    viaTeleporter: opts.viaTeleporter,
    availableMineSlots: opts.listMineSlots(),
  });
}

export function tutorialJoinRoomAllowed(opts: {
  targetRoomId: string;
  wallet: string;
  sessionNimiqPay: boolean;
  isAdminOrBuilder: boolean;
  viaTeleporter?: boolean;
}): { ok: true } | { ok: false; reason: string } {
  const decision = evaluateTutorialRoomJoin(opts);
  if (decision.ok) return { ok: true };
  return { ok: false, reason: decision.reason };
}

export function tutorialLessonSuppressesChat(
  roomId: string,
  welcome: TutorialWelcome | undefined
): boolean {
  return isTutorialRuntimeRoomId(roomId) && welcome?.lessonMode === true;
}

export function tutorialTryFinalizeMineClaim(opts: {
  roomId: string;
  wallet: string;
  tileKey: string;
  props: TerrainProps;
  sandboxMode: boolean;
  listMineSlots: () => string[];
}): { ok: true; claimId: string; rewardLuna: bigint } | { ok: false; reason: string } {
  if (!isTutorialRuntimeRoomId(opts.roomId) && !isTutorialStagingRoomId(opts.roomId)) {
    return { ok: false, reason: "not_tutorial_room" };
  }
  if (isTutorialStagingRoomId(opts.roomId)) {
    return { ok: false, reason: "staging_no_payout" };
  }
  if (opts.sandboxMode) return { ok: false, reason: "sandbox" };
  if (!opts.props.tutorialMineSlot) return { ok: false, reason: "not_tutorial_slot" };
  const slots = opts.listMineSlots();
  if (!canClaimTutorialMineSlot(opts.wallet, opts.tileKey, opts.roomId, slots)) {
    return { ok: false, reason: "wrong_slot" };
  }
  if (isTutorialMineAlreadyClaimed(opts.wallet)) {
    return { ok: false, reason: "already_claimed" };
  }
  markTutorialMineComplete(opts.wallet);
  return {
    ok: true,
    claimId: tutorialFaucetClaimId(opts.wallet),
    rewardLuna: getTutorialFaucetRewardLuna(),
  };
}

export function tutorialBypassBalancePeek(roomId: string, wallet: string): boolean {
  return shouldBypassTutorialFaucetBalancePeek(roomId, wallet);
}

export function tutorialGateMayOpen(wallet: string): boolean {
  return isTutorialGatePassableForWallet(wallet);
}

export function tutorialAckDoorSent(
  wallet: string
): { ok: true; idempotent: boolean } | { ok: false; error: string } {
  return ackTutorialDoorSent(wallet);
}

export function tutorialMaybeCompleteOnHubEntry(opts: {
  fromRoomId: string | null;
  toRoomId: string;
  wallet: string;
  viaEscape?: boolean;
  onUnlock?: (unlocks: import("../achievementStore.js").AchievementUnlockWire[]) => void;
}): boolean {
  if (opts.viaEscape) return false;
  if (normalizeRoom(opts.toRoomId) !== CHAMBER_ROOM_ID) return false;
  if (!opts.fromRoomId || normalizeRoom(opts.fromRoomId) !== TUTORIAL_ROOM_ID) {
    return false;
  }
  const profile = getTutorialProfileRow(opts.wallet);
  if (typeof profile.tutorialSession?.doorPaidAt !== "number") {
    return false;
  }
  const row = completeTutorial(opts.wallet);
  if (row.ok && row.firstComplete) {
    fireAchievementEvent(opts.wallet, "tutorial_first_nim", opts.onUnlock);
    return true;
  }
  return false;
}

function normalizeRoom(roomId: string): string {
  return roomId.trim().toLowerCase();
}

export function resolveInitialRoomForPaySession(opts: {
  wallet: string;
  sessionNimiqPay: boolean;
  requestedRoomId: string;
}): string {
  if (!computeNeedsTutorial(opts.sessionNimiqPay, opts.wallet)) {
    return opts.requestedRoomId;
  }
  return TUTORIAL_ROOM_ID;
}

export function teleporterMayTargetTutorialRoom(
  destRoomId: string,
  setterIsAdmin: boolean
): boolean {
  if (!isTutorialRuntimeRoomId(destRoomId)) return true;
  return setterIsAdmin && isTutorialFeatureEnabled();
}

export { computeNeedsTutorial };
