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
import { CHAMBER_ROOM_ID } from "../roomLayouts.js";
import { fireAchievementEvent } from "../achievementStore.js";
import { getTutorialProfileRow } from "../playerProfileStore.js";

export function tutorialRoomHiddenFromCatalog(roomId: string): boolean {
  return isTutorialRoomHiddenFromCatalog(roomId);
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
  return setterIsAdmin;
}

export { computeNeedsTutorial };
