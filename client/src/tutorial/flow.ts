import { gateApproachTile } from "../game/gateAuth.js";

/** Client-side Nimiq Pay first-contact tutorial helpers. */

export const TUTORIAL_ROOM_ID = "tutorial";

export const TUTORIAL_ESCAPE_MS =
  Number(import.meta.env.VITE_TUTORIAL_ESCAPE_MS) || 10_000;
export const TUTORIAL_ESCAPE_COUNTDOWN_MS =
  Number(import.meta.env.VITE_TUTORIAL_ESCAPE_COUNTDOWN_MS) || 5_000;

export type TutorialWelcome = {
  needsTutorial: boolean;
  completedAt?: number;
  mode: "lesson" | "sandbox";
  session?: {
    mineSlotTile?: string;
    mineCompletedAt?: number;
    doorPaidAt?: number;
    gateUnstuckAt?: number;
    lastStep?: "mine" | "pay" | "exit";
  };
  mineTile?: string;
  lessonMode?: boolean;
};

export type TutorialDoorQuote = {
  amountLuna: string;
  amountNim: string;
  recipient: string;
  memo: string;
};

export type TutorialHubExitDoor = {
  x: number;
  z: number;
  targetRoomId: string;
  spawnX: number;
  spawnZ: number;
};

export function parseTutorialMineTileCoords(
  mineTile?: string
): { x: number; z: number } | null {
  if (!mineTile?.trim()) return null;
  const parts = mineTile.split(",").map(Number);
  if (
    parts.length < 2 ||
    !Number.isFinite(parts[0]) ||
    !Number.isFinite(parts[1])
  ) {
    return null;
  }
  return { x: Math.floor(parts[0]!), z: Math.floor(parts[1]!) };
}

export function shouldShowTutorialMineHighlight(
  welcome: TutorialWelcome | undefined
): boolean {
  if (!welcome?.lessonMode || !welcome.mineTile) return false;
  if (typeof welcome.session?.mineCompletedAt === "number") return false;
  return true;
}

export type TutorialCoachStep = "mine" | "pay" | "exit";

export const TUTORIAL_WRONG_SLOT_REASON =
  "Click and hold your glowing block.";

export const TUTORIAL_ALREADY_CLAIMED_REASON =
  "You already mined your tutorial block.";

export const TUTORIAL_COACH_HINTS: Record<TutorialCoachStep, string> = {
  mine: "Click and hold your glowing block to receive NIM.",
  pay: "Stand beside the Unlock Pad and tap Unlock Pad.",
  exit: "Walk through the open gate to the Hub.",
};

export type TutorialCoachState = {
  visible: boolean;
  current: TutorialCoachStep;
  completed: TutorialCoachStep[];
  hint: string;
};

/** Lesson-mode chrome only in the Tutorial Room; hidden in sandbox and after completion. */
export function shouldShowTutorialStepCoach(
  welcome: TutorialWelcome | undefined,
  roomId?: string | null
): boolean {
  if (!welcome?.lessonMode) return false;
  if (welcome.mode === "sandbox") return false;
  if (typeof welcome.completedAt === "number") return false;
  const rid = String(roomId ?? "").trim().toLowerCase();
  if (rid !== TUTORIAL_ROOM_ID) return false;
  return true;
}

/**
 * Derive Tutorial Step Coach from welcome/session timestamps.
 * Escape (`gateUnstuckAt`) counts as completing Pay so the coach can advance to Exit.
 * Only visible while the player is in the Tutorial Room.
 */
export function deriveTutorialCoachState(
  welcome: TutorialWelcome | undefined,
  roomId?: string | null
): TutorialCoachState | null {
  if (!shouldShowTutorialStepCoach(welcome, roomId)) return null;

  const session = welcome?.session;
  const mineDone = typeof session?.mineCompletedAt === "number";
  const payDone =
    typeof session?.doorPaidAt === "number" ||
    typeof session?.gateUnstuckAt === "number";

  const completed: TutorialCoachStep[] = [];
  if (mineDone) completed.push("mine");
  if (payDone) completed.push("pay");

  let current: TutorialCoachStep = "mine";
  if (mineDone && !payDone) current = "pay";
  else if (mineDone && payDone) current = "exit";

  return {
    visible: true,
    current,
    completed,
    hint: TUTORIAL_COACH_HINTS[current],
  };
}

export type TutorialFlowCallbacks = {
  onEscapeCountdown?: (secondsLeft: number) => void;
  onEscapeFire?: () => void;
  showToast?: (text: string) => void;
  showSystemChat?: (text: string) => void;
};

export class TutorialEscapeTimer {
  private armed = false;
  private startedAt = 0;
  private interval: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly cb: TutorialFlowCallbacks) {}

  arm(): void {
    this.disarm();
    this.armed = true;
    this.startedAt = Date.now();
    this.interval = setInterval(() => this.tick(), 250);
  }

  disarm(): void {
    this.armed = false;
    this.startedAt = 0;
    if (this.interval !== null) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private tick(): void {
    if (!this.armed) return;
    const elapsed = Date.now() - this.startedAt;
    const remaining = TUTORIAL_ESCAPE_MS - elapsed;
    if (remaining <= TUTORIAL_ESCAPE_COUNTDOWN_MS) {
      const sec = Math.max(0, Math.ceil(remaining / 1000));
      this.cb.onEscapeCountdown?.(sec);
    }
    if (remaining <= 0) {
      this.disarm();
      this.cb.onEscapeFire?.();
    }
  }
}

export async function fetchTutorialDoorQuote(
  token: string,
  apiBase: string
): Promise<TutorialDoorQuote | null> {
  const res = await fetch(`${apiBase}/api/tutorial/door-quote`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return (await res.json()) as TutorialDoorQuote;
}

export async function postTutorialDoorSent(
  token: string,
  apiBase: string
): Promise<{ ok: true; hubExitDoor?: TutorialHubExitDoor } | { ok: false }> {
  const res = await fetch(`${apiBase}/api/tutorial/door-sent`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return { ok: false };
  const body = (await res.json()) as {
    hubExitDoor?: TutorialHubExitDoor;
  };
  return { ok: true, hubExitDoor: body.hubExitDoor };
}

export async function postTutorialUnstick(
  token: string,
  apiBase: string
): Promise<boolean> {
  const res = await fetch(`${apiBase}/api/tutorial/unstick`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.ok;
}

export async function postTutorialAbandon(
  token: string,
  apiBase: string
): Promise<boolean> {
  const res = await fetch(`${apiBase}/api/tutorial/abandon`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.ok;
}

/** Nimiq Pay send with optional escape timer while promise is pending. */
export async function sendTutorialDoorPayment(opts: {
  quote: TutorialDoorQuote;
  escape: TutorialEscapeTimer;
}): Promise<{ ok: true } | { ok: false; cancelled: boolean }> {
  const pay = window.nimiqPay;
  if (!pay?.sendBasicTransactionWithData) {
    return { ok: false, cancelled: false };
  }
  opts.escape.arm();
  try {
    await pay.sendBasicTransactionWithData({
      recipient: opts.quote.recipient,
      value: BigInt(opts.quote.amountLuna),
      data: opts.quote.memo,
    });
    opts.escape.disarm();
    return { ok: true };
  } catch (e) {
    opts.escape.disarm();
    const msg = String(e ?? "");
    const cancelled =
      msg.toLowerCase().includes("cancel") ||
      msg.toLowerCase().includes("reject");
    return { ok: false, cancelled };
  }
}

export function tutorialSuppressesSocial(welcome: TutorialWelcome | undefined): boolean {
  return welcome?.lessonMode === true;
}

export function shouldShowFinishTutorialMenu(
  sessionNimiqPay: boolean,
  welcome: TutorialWelcome | undefined
): boolean {
  return (
    sessionNimiqPay &&
    welcome?.needsTutorial === true &&
    typeof welcome.completedAt !== "number"
  );
}

/** Label for the above-head intent pill when standing at the tutorial gate. */
export const TUTORIAL_UNLOCK_GATE_LABEL = "Unlock Pad";

/**
 * Lesson Pay step: mine done, door not yet paid / unstuck.
 * Used to show the Unlock Gate intent pill in front of the gate.
 */
export function shouldOfferTutorialUnlockGate(
  welcome: TutorialWelcome | undefined
): boolean {
  if (!welcome?.lessonMode) return false;
  if (welcome.mode === "sandbox") return false;
  if (typeof welcome.session?.mineCompletedAt !== "number") return false;
  if (typeof welcome.session?.doorPaidAt === "number") return false;
  if (typeof welcome.session?.gateUnstuckAt === "number") return false;
  return true;
}

/** Floor tile on the approach side of a gate (opposite the exit neighbor). */
export function tutorialGateApproachTile(
  gateX: number,
  gateZ: number,
  exitX: number,
  exitZ: number
): { x: number; z: number } {
  return gateApproachTile(gateX, gateZ, exitX, exitZ);
}

export function isStandingOnTutorialGateApproach(
  selfTile: { x: number; z: number },
  gate: { gateX: number; gateZ: number; exitX: number; exitZ: number }
): boolean {
  const approach = tutorialGateApproachTile(
    gate.gateX,
    gate.gateZ,
    gate.exitX,
    gate.exitZ
  );
  return selfTile.x === approach.x && selfTile.z === approach.z;
}
