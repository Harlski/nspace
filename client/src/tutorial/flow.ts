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

/**
 * Layout tiles the Step Coach can point at with local Attention Markers.
 * Resolved from room geometry (Unlock Pads / Hub exit) and gold (claimable) mines.
 */
export type TutorialAttentionLayout = {
  /** All gold / claimable mine blocks in the Tutorial Room. */
  mineTiles: readonly { x: number; z: number }[];
  /** All Unlock Pad tiles in the Tutorial Room. */
  unlockPadTiles: readonly { x: number; z: number }[];
  exitTile: { x: number; z: number } | null;
};

/**
 * Client-local Attention Marker tiles for the current Tutorial Step Coach step.
 * Shared room markers stay authored; these cues are per-learner and not synced.
 * Hidden once the lesson is marked complete (`completedAt`).
 *
 * Step 1 (Mine): every gold mine block. Step 2 (Pay): every Unlock Pad.
 * Step 3 (Exit): Exit Teleporter tile.
 */
export function resolveTutorialAttentionTargets(
  welcome: TutorialWelcome | undefined,
  roomId: string | null | undefined,
  layout: TutorialAttentionLayout
): { x: number; z: number }[] {
  const coach = deriveTutorialCoachState(welcome, roomId);
  if (!coach) return [];
  if (typeof welcome?.completedAt === "number") return [];
  switch (coach.current) {
    case "mine":
      return layout.mineTiles.map((t) => ({ x: t.x, z: t.z }));
    case "pay":
      return layout.unlockPadTiles.map((t) => ({ x: t.x, z: t.z }));
    case "exit":
      return layout.exitTile
        ? [{ x: layout.exitTile.x, z: layout.exitTile.z }]
        : [];
    default:
      return [];
  }
}

/** @deprecated Prefer {@link resolveTutorialAttentionTargets}. */
export function resolveTutorialAttentionTarget(
  welcome: TutorialWelcome | undefined,
  roomId: string | null | undefined,
  layout: {
    mineTile: { x: number; z: number } | null;
    unlockPadTile: { x: number; z: number } | null;
    exitTile: { x: number; z: number } | null;
  }
): { x: number; z: number } | null {
  const targets = resolveTutorialAttentionTargets(welcome, roomId, {
    mineTiles: layout.mineTile ? [layout.mineTile] : [],
    unlockPadTiles: layout.unlockPadTile ? [layout.unlockPadTile] : [],
    exitTile: layout.exitTile,
  });
  return targets[0] ?? null;
}

export type TutorialCoachStep = "mine" | "pay" | "exit";

export const TUTORIAL_WRONG_SLOT_REASON =
  "Click and hold your glowing block.";

export const TUTORIAL_ALREADY_CLAIMED_REASON =
  "You already mined your tutorial block.";

export const TUTORIAL_COACH_HINTS: Record<TutorialCoachStep, string> = {
  mine: "Click and hold a glowing gold block to receive NIM.",
  pay: "Stand beside the Unlock Pad and tap Unlock.",
  exit: "Walk through the open pad and Enter the Exit Teleporter.",
};

/** Full-screen cinematic titles fired once when each tutorial step completes. */
export const TUTORIAL_CINEMATIC_TITLES = {
  mine: "You just earned NIM",
  pay: "You just spent NIM",
  /** Hub arrival after Exit; brand “Nimiq” is tinted in the HUD renderer. */
  exit: "Welcome to Nimiq Space",
} as const;

export type TutorialCoachState = {
  visible: boolean;
  current: TutorialCoachStep;
  completed: TutorialCoachStep[];
  hint: string;
};

/** Progress strip in the Tutorial Room (lesson or sandbox / teleporter revisit). */
export function shouldShowTutorialStepCoach(
  welcome: TutorialWelcome | undefined,
  roomId?: string | null
): boolean {
  if (!welcome) return false;
  const rid = String(roomId ?? "").trim().toLowerCase();
  if (rid !== TUTORIAL_ROOM_ID) return false;
  return true;
}

/**
 * Apply a successful Step 1 mine onto local `welcome.session` so the Step Coach
 * advances to Pay. After Reset, welcome may be sandbox (`lessonMode` false);
 * promote to lesson so the Unlock Pad intent pill and Pay flow stay available.
 */
export function withTutorialMineCompleted(
  welcome: TutorialWelcome,
  nowMs = Date.now()
): TutorialWelcome {
  if (typeof welcome.completedAt === "number") return welcome;
  if (typeof welcome.session?.mineCompletedAt === "number") {
    // Already mined but may still be sandbox after Reset - ensure Pay UI unlocks.
    if (welcome.lessonMode === true && welcome.mode === "lesson") return welcome;
    return {
      ...welcome,
      mode: "lesson",
      lessonMode: true,
    };
  }
  return {
    ...welcome,
    mode: "lesson",
    lessonMode: true,
    session: {
      ...(welcome.session ?? {}),
      mineCompletedAt: nowMs,
      lastStep: "pay",
    },
  };
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
  const lessonComplete = typeof welcome?.completedAt === "number";

  const completed: TutorialCoachStep[] = [];
  if (mineDone || lessonComplete) completed.push("mine");
  if (payDone || lessonComplete) completed.push("pay");
  if (lessonComplete) completed.push("exit");

  let current: TutorialCoachStep = "mine";
  if (lessonComplete) current = "exit";
  else if (mineDone && !payDone) current = "pay";
  else if (mineDone && payDone) current = "exit";

  const hint = lessonComplete
    ? "Tutorial complete - explore the path anytime."
    : TUTORIAL_COACH_HINTS[current];

  return {
    visible: true,
    current,
    completed,
    hint,
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
  url: string
): Promise<TutorialDoorQuote | null> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return (await res.json()) as TutorialDoorQuote;
}

export async function postTutorialDoorSent(
  token: string,
  url: string
): Promise<{ ok: true; hubExitDoor?: TutorialHubExitDoor } | { ok: false }> {
  const res = await fetch(url, {
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
  url: string
): Promise<boolean> {
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.ok;
}

export async function postTutorialAbandon(
  token: string,
  url: string
): Promise<boolean> {
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.ok;
}

/** Clear tutorial session so the lesson restarts at Mine. */
export async function postTutorialResetProgress(
  token: string,
  url: string
): Promise<boolean> {
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.ok;
}

/** True when local/dev may skip the real Nimiq Pay send for optimistic tutorial ack. */
export function canSimulateTutorialDoorPayment(): boolean {
  if (typeof import.meta === "undefined") return false;
  if (import.meta.env.DEV) return true;
  return import.meta.env.VITE_DEV_AUTH_BYPASS === "1";
}

const HUB_URL = import.meta.env.VITE_HUB_URL || "https://hub.nimiq.com";

/** Hub checkout request for a tutorial door quote (Pay-less desktop path). */
function buildTutorialDoorHubCheckoutRequest(quote: TutorialDoorQuote): {
  appName: string;
  recipient: string;
  value: number;
  extraData: string;
} {
  const luna = Number(quote.amountLuna);
  if (!Number.isFinite(luna) || luna < 1) throw new Error("invalid_amount");
  return {
    appName: "Nimiq Space",
    recipient: quote.recipient,
    value: Math.floor(luna),
    extraData: quote.memo,
  };
}

function isTutorialPayUserCancel(err: unknown): boolean {
  const msg = String(err ?? "").toLowerCase();
  return (
    msg.includes("cancel") ||
    msg.includes("abort") ||
    msg.includes("denied") ||
    msg.includes("reject") ||
    msg.includes("dismiss") ||
    msg.includes("closed")
  );
}

/**
 * Send the tutorial door payment while arming the escape timer.
 * Nimiq Pay host when injected (mini-app), else Nimiq Hub checkout (desktop /
 * Hub login). Only local DEV without a Pay host simulates an optimistic send.
 */
export async function sendTutorialDoorPayment(opts: {
  quote: TutorialDoorQuote;
  escape: TutorialEscapeTimer;
}): Promise<
  | { ok: true; simulated?: boolean }
  | { ok: false; cancelled: boolean; reason?: "pay_unavailable" }
> {
  const pay = window.nimiqPay;
  const hasPayHost = Boolean(pay?.sendBasicTransactionWithData);
  if (!hasPayHost && canSimulateTutorialDoorPayment()) {
    // Local DEV without a Pay host - simulate optimistic send.
    return { ok: true, simulated: true };
  }
  opts.escape.arm();
  try {
    if (pay?.sendBasicTransactionWithData) {
      await pay.sendBasicTransactionWithData({
        recipient: opts.quote.recipient,
        value: BigInt(opts.quote.amountLuna),
        data: opts.quote.memo,
      });
    } else {
      const { default: HubApi } = await import("@nimiq/hub-api");
      const hub = new HubApi(HUB_URL);
      await hub.checkout(buildTutorialDoorHubCheckoutRequest(opts.quote));
    }
    opts.escape.disarm();
    return { ok: true };
  } catch (e) {
    opts.escape.disarm();
    return { ok: false, cancelled: isTutorialPayUserCancel(e) };
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
export const TUTORIAL_UNLOCK_GATE_LABEL = "Unlock";

/**
 * Tutorial Pay step: mine done, door not yet paid / unstuck, lesson incomplete.
 * Used to show the Unlock Gate / Unlock Pad intent pill (works after Reset even
 * when welcome briefly arrives as sandbox).
 */
export function shouldOfferTutorialUnlockGate(
  welcome: TutorialWelcome | undefined
): boolean {
  if (!welcome) return false;
  if (typeof welcome.completedAt === "number") return false;
  if (typeof welcome.session?.mineCompletedAt !== "number") return false;
  if (typeof welcome.session?.doorPaidAt === "number") return false;
  if (typeof welcome.session?.gateUnstuckAt === "number") return false;
  return true;
}

/**
 * Show Reset tutorial while in the Tutorial Room.
 * Player Menu only (coach strip has no Start over).
 * When the learner flow is off, only admins (who may still enter via teleporter).
 * Admins keep access after completion so they can re-test the lesson.
 */
export function shouldShowTutorialResetMenu(opts: {
  inTutorialRoom: boolean;
  isAdmin: boolean;
  tutorialFeatureEnabled: boolean;
}): boolean {
  if (!opts.inTutorialRoom) return false;
  if (opts.isAdmin) return true;
  return opts.tutorialFeatureEnabled;
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
