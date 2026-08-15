import { CHAMBER_ROOM_ID, normalizeRoomId } from "../game/roomLayouts.js";

/** How long a solid black veil may stay up before the spinner and room label appear. */
export const LOADING_SPINNER_REVEAL_MS = 1_200;
/** How long a non-Hub load may run before offering Return to Hub on the overlay. */
export const LOADING_RETURN_TO_HUB_MS = 8_000;

export type LoadingFeedbackStart = {
  /** Room we believe we are joining; null when resume has not named it yet. */
  targetRoomId: string | null;
  /** True when the overlay is a solid black veil with chrome hidden. */
  blackout: boolean;
};

export function isHubLoadingTarget(
  roomId: string | null | undefined
): boolean {
  if (!roomId) return false;
  return normalizeRoomId(roomId) === CHAMBER_ROOM_ID;
}

export function createLoadingFeedbackController(opts: {
  onRevealSpinner: () => void;
  onRevealReturnToHub: () => void;
  onReset: () => void;
  spinnerAfterMs?: number;
  returnToHubAfterMs?: number;
}): {
  start: (input: LoadingFeedbackStart) => void;
  ensureStarted: (input: LoadingFeedbackStart) => void;
  stop: () => void;
} {
  const spinnerAfterMs = opts.spinnerAfterMs ?? LOADING_SPINNER_REVEAL_MS;
  const returnToHubAfterMs = opts.returnToHubAfterMs ?? LOADING_RETURN_TO_HUB_MS;
  let running = false;
  let spinnerTimer: ReturnType<typeof setTimeout> | null = null;
  let returnTimer: ReturnType<typeof setTimeout> | null = null;

  const clearTimers = (): void => {
    if (spinnerTimer !== null) {
      clearTimeout(spinnerTimer);
      spinnerTimer = null;
    }
    if (returnTimer !== null) {
      clearTimeout(returnTimer);
      returnTimer = null;
    }
  };

  const stop = (): void => {
    clearTimers();
    if (!running) return;
    running = false;
    opts.onReset();
  };

  const start = (input: LoadingFeedbackStart): void => {
    stop();
    running = true;
    if (input.blackout) {
      spinnerTimer = setTimeout(() => {
        spinnerTimer = null;
        opts.onRevealSpinner();
      }, spinnerAfterMs);
    }
    if (!isHubLoadingTarget(input.targetRoomId)) {
      returnTimer = setTimeout(() => {
        returnTimer = null;
        opts.onRevealSpinner();
        opts.onRevealReturnToHub();
      }, returnToHubAfterMs);
    }
  };

  const ensureStarted = (input: LoadingFeedbackStart): void => {
    if (running) return;
    start(input);
  };

  return { start, ensureStarted, stop };
}
