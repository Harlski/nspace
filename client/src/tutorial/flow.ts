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
): Promise<boolean> {
  const res = await fetch(`${apiBase}/api/tutorial/door-sent`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.ok;
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
