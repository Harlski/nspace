import {
  getTutorialDoorAmountLuna,
  getTutorialDoorRecipientAddress,
  getTutorialFaucetAmountLuna,
  isTutorialFeatureEnabled,
  isTutorialRuntimeRoomId,
  isTutorialStagingRoomId,
  TUTORIAL_ROOM_ID,
  TUTORIAL_STAGING_ROOM_ID,
} from "./tutorial/config.js";
import {
  clearTutorialProgress,
  getTutorialProfileRow,
  listTutorialMineSlotAssignments,
  patchTutorialProfileRow,
  type TutorialLastStep,
  type TutorialSession,
} from "./playerProfileStore.js";
import { LUNA_PER_NIM } from "./payoutGateway.js";
import {
  clearUnlockPadGrantsForWalletInRoom,
  recordUnlockPadGrant,
} from "./unlockPad/index.js";

export type { TutorialLastStep, TutorialSession };

export type TutorialMode = "lesson" | "sandbox";

export type TutorialWelcome = {
  needsTutorial: boolean;
  completedAt?: number;
  mode: TutorialMode;
  session?: TutorialSession;
  /** Client highlight target for assigned mine slot. */
  mineTile?: string;
  /** Suppress chat and emotes during lesson mode. */
  lessonMode?: boolean;
};

export type TutorialDoorQuote = {
  amountLuna: string;
  amountNim: string;
  recipient: string;
  memo: string;
};

function normalizeWallet(address: string): string {
  return String(address ?? "")
    .replace(/\s+/g, "")
    .trim()
    .toUpperCase();
}

function hashWalletSlotIndex(wallet: string, slotCount: number): number {
  let h = 0;
  for (let i = 0; i < wallet.length; i++) {
    h = (h * 31 + wallet.charCodeAt(i)) >>> 0;
  }
  return slotCount > 0 ? h % slotCount : 0;
}

export function computeNeedsTutorial(
  sessionNimiqPay: boolean,
  wallet: string
): boolean {
  if (!isTutorialFeatureEnabled()) return false;
  if (!sessionNimiqPay) return false;
  const key = normalizeWallet(wallet);
  if (!key) return false;
  const row = getTutorialProfileRow(key);
  return typeof row.tutorialCompletedAt !== "number";
}

export function getTutorialCompletedAt(wallet: string): number | undefined {
  const row = getTutorialProfileRow(normalizeWallet(wallet));
  return row.tutorialCompletedAt;
}

export function resolveTutorialMode(opts: {
  roomId: string;
  wallet: string;
  sessionNimiqPay: boolean;
  viaTeleporter?: boolean;
}): TutorialMode {
  if (!isTutorialRuntimeRoomId(opts.roomId)) return "lesson";
  const completed = getTutorialCompletedAt(opts.wallet);
  if (typeof completed === "number") return "sandbox";
  if (!opts.sessionNimiqPay && !opts.viaTeleporter) return "sandbox";
  if (opts.viaTeleporter && typeof completed === "number") return "sandbox";
  if (typeof completed === "number") return "sandbox";
  return "lesson";
}

export function buildTutorialWelcomePayload(opts: {
  wallet: string;
  roomId: string;
  sessionNimiqPay: boolean;
  viaTeleporter?: boolean;
  availableMineSlots?: readonly string[];
  /** Admin preview while learner flow is off (Reset tutorial / coach in Tutorial Room). */
  allowWhenFeatureOff?: boolean;
}): TutorialWelcome | undefined {
  if (!isTutorialFeatureEnabled() && !opts.allowWhenFeatureOff) return undefined;
  if (!isTutorialRuntimeRoomId(opts.roomId) && !computeNeedsTutorial(opts.sessionNimiqPay, opts.wallet)) {
    return undefined;
  }
  const key = normalizeWallet(opts.wallet);
  const row = getTutorialProfileRow(key);
  const needsTutorial = computeNeedsTutorial(opts.sessionNimiqPay, key);
  const mode = resolveTutorialMode({
    roomId: opts.roomId,
    wallet: key,
    sessionNimiqPay: opts.sessionNimiqPay,
    viaTeleporter: opts.viaTeleporter,
  });
  const session = row.tutorialSession;
  let mineTile = session?.mineSlotTile;
  if (
    mode === "lesson" &&
    opts.roomId.trim().toLowerCase() === TUTORIAL_ROOM_ID &&
    opts.availableMineSlots?.length
  ) {
    mineTile = ensureTutorialMineSlot(key, opts.availableMineSlots) ?? undefined;
  }
  const payload: TutorialWelcome = {
    needsTutorial,
    mode,
    completedAt: row.tutorialCompletedAt,
    session,
    mineTile,
    lessonMode: mode === "lesson",
  };
  if (!isTutorialRuntimeRoomId(opts.roomId) && !needsTutorial) {
    return undefined;
  }
  return payload;
}

export function ensureTutorialMineSlot(
  wallet: string,
  availableSlots: readonly string[]
): string | null {
  const key = normalizeWallet(wallet);
  if (!key || availableSlots.length === 0) return null;
  const sorted = [...availableSlots].sort();
  const row = getTutorialProfileRow(key);
  const existing = row.tutorialSession?.mineSlotTile;
  if (existing && sorted.includes(existing)) return existing;

  const used = new Set(listTutorialMineSlotAssignments(key));
  const start = hashWalletSlotIndex(key, sorted.length);
  for (let i = 0; i < sorted.length; i++) {
    const slot = sorted[(start + i) % sorted.length]!;
    if (!used.has(slot)) {
      patchTutorialProfileRow(key, {
        tutorialSession: {
          ...row.tutorialSession,
          mineSlotTile: slot,
          lastStep: row.tutorialSession?.lastStep ?? "mine",
        },
      });
      return slot;
    }
  }
  const fallback = sorted[0]!;
  patchTutorialProfileRow(key, {
    tutorialSession: {
      ...row.tutorialSession,
      mineSlotTile: fallback,
      lastStep: row.tutorialSession?.lastStep ?? "mine",
    },
  });
  return fallback;
}

export function canClaimTutorialMineSlot(
  wallet: string,
  tileKey: string,
  roomId: string,
  availableSlots: readonly string[]
): boolean {
  if (isTutorialStagingRoomId(roomId)) return false;
  // Step 1: any Tutorial Mine Slot (or listed gold mine) is claimable.
  if (availableSlots.length > 0) {
    return availableSlots.includes(tileKey);
  }
  // Fallback: keep assigned-slot check if no slot list was provided.
  const assigned = ensureTutorialMineSlot(wallet, availableSlots);
  return assigned === tileKey;
}

export function isTutorialMineAlreadyClaimed(wallet: string): boolean {
  const row = getTutorialProfileRow(normalizeWallet(wallet));
  return typeof row.tutorialSession?.mineCompletedAt === "number";
}

export function markTutorialMineComplete(wallet: string, nowMs = Date.now()): void {
  const key = normalizeWallet(wallet);
  const row = getTutorialProfileRow(key);
  if (typeof row.tutorialSession?.mineCompletedAt === "number") return;
  patchTutorialProfileRow(key, {
    tutorialSession: {
      ...row.tutorialSession,
      mineCompletedAt: nowMs,
      lastStep: "pay",
    },
  });
}

export function tutorialFaucetClaimId(wallet: string): string {
  return `tutorial-mine-${normalizeWallet(wallet)}`;
}

export function getTutorialDoorQuote(wallet: string): TutorialDoorQuote | null {
  const key = normalizeWallet(wallet);
  if (!key) return null;
  const luna = getTutorialDoorAmountLuna();
  const recipient = getTutorialDoorRecipientAddress();
  if (!recipient) return null;
  const nim = (Number(luna) / Number(LUNA_PER_NIM)).toFixed(4);
  return {
    amountLuna: luna.toString(),
    amountNim: nim,
    recipient,
    memo: `tutorial-door:${key}`,
  };
}

export function ackTutorialDoorSent(
  wallet: string,
  nowMs = Date.now()
): { ok: true; idempotent: boolean } | { ok: false; error: string } {
  const key = normalizeWallet(wallet);
  if (!key) return { ok: false, error: "invalid_address" };
  const row = getTutorialProfileRow(key);
  if (typeof row.tutorialCompletedAt === "number") {
    return { ok: false, error: "tutorial_already_complete" };
  }
  const idempotent = typeof row.tutorialSession?.doorPaidAt === "number";
  if (!idempotent) {
    patchTutorialProfileRow(key, {
      tutorialSession: {
        ...row.tutorialSession,
        doorPaidAt: nowMs,
        lastStep: "exit",
      },
    });
  }
  return { ok: true, idempotent };
}

/** Grant Unlock Pad walkability for the tutorial Pay pad (optimistic / escape). */
export function grantTutorialUnlockPad(
  wallet: string,
  roomId: string,
  instanceId: string,
  nowMs = Date.now()
): void {
  recordUnlockPadGrant({
    wallet,
    roomId,
    instanceId,
    nowMs,
  });
}

export function unstickTutorialGate(
  wallet: string,
  nowMs = Date.now()
): void {
  const key = normalizeWallet(wallet);
  const row = getTutorialProfileRow(key);
  patchTutorialProfileRow(key, {
    tutorialSession: {
      ...row.tutorialSession,
      gateUnstuckAt: nowMs,
      lastStep: "exit",
    },
  });
}

export function abandonTutorial(wallet: string, nowMs = Date.now()): void {
  const key = normalizeWallet(wallet);
  patchTutorialProfileRow(key, { tutorialAbandonedAt: nowMs });
}

/** Testing / admin: clear lesson progress so the wallet restarts at Mine. */
export function resetTutorialProgress(
  wallet: string
): { ok: true } | { ok: false; error: string } {
  const key = normalizeWallet(wallet);
  if (!key) return { ok: false, error: "invalid_address" };
  clearTutorialProgress(key);
  clearUnlockPadGrantsForWalletInRoom(key, TUTORIAL_ROOM_ID);
  return { ok: true };
}

export function isTutorialGatePassableForWallet(wallet: string): boolean {
  const row = getTutorialProfileRow(normalizeWallet(wallet));
  const s = row.tutorialSession;
  if (!s) return false;
  return (
    typeof s.doorPaidAt === "number" || typeof s.gateUnstuckAt === "number"
  );
}

export function completeTutorial(
  wallet: string,
  nowMs = Date.now()
): { ok: true; firstComplete: boolean } | { ok: false; error: string } {
  const key = normalizeWallet(wallet);
  if (!key) return { ok: false, error: "invalid_address" };
  const row = getTutorialProfileRow(key);
  if (typeof row.tutorialCompletedAt === "number") {
    return { ok: true, firstComplete: false };
  }
  patchTutorialProfileRow(key, {
    tutorialCompletedAt: nowMs,
    tutorialSession: {
      ...row.tutorialSession,
      lastStep: "exit",
    },
  });
  return { ok: true, firstComplete: true };
}

export type TutorialJoinDecision =
  | { ok: true }
  | { ok: false; reason: "tutorial_complete_use_teleporter" | "not_found" | "forbidden" };

export function evaluateTutorialRoomJoin(opts: {
  targetRoomId: string;
  wallet: string;
  sessionNimiqPay: boolean;
  isAdminOrBuilder: boolean;
  viaTeleporter?: boolean;
}): TutorialJoinDecision {
  const id = opts.targetRoomId.trim().toLowerCase();
  if (id !== TUTORIAL_ROOM_ID && id !== TUTORIAL_STAGING_ROOM_ID) {
    return { ok: true };
  }
  // Feature off: learners stay in Hub; admins/builders may still enter (teleporter, staging).
  if (!isTutorialFeatureEnabled()) {
    return opts.isAdminOrBuilder
      ? { ok: true }
      : { ok: false, reason: "not_found" };
  }
  if (id === TUTORIAL_STAGING_ROOM_ID) {
    return opts.isAdminOrBuilder ? { ok: true } : { ok: false, reason: "forbidden" };
  }
  const completed = typeof getTutorialCompletedAt(opts.wallet) === "number";
  if (completed && !opts.viaTeleporter && opts.sessionNimiqPay) {
    return { ok: false, reason: "tutorial_complete_use_teleporter" };
  }
  if (completed && opts.viaTeleporter) return { ok: true };
  if (!completed && opts.sessionNimiqPay) return { ok: true };
  if (opts.isAdminOrBuilder) return { ok: true };
  if (opts.viaTeleporter) return { ok: true };
  return { ok: false, reason: "forbidden" };
}

export function shouldBypassTutorialFaucetBalancePeek(
  roomId: string,
  wallet: string
): boolean {
  if (!isTutorialRuntimeRoomId(roomId)) return false;
  if (isTutorialStagingRoomId(roomId)) return true;
  return computeNeedsTutorial(true, wallet);
}

export function getTutorialFaucetRewardLuna(): bigint {
  return getTutorialFaucetAmountLuna();
}
