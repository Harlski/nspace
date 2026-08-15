import { afterEach, describe, expect, it, vi } from "vitest";
import { CHAMBER_ROOM_ID, HUB_ROOM_ID } from "../game/roomLayouts.js";
import {
  LOADING_RETURN_TO_HUB_MS,
  LOADING_SPINNER_REVEAL_MS,
  createLoadingFeedbackController,
  isHubLoadingTarget,
} from "./loadingFeedback.js";

describe("isHubLoadingTarget", () => {
  it("treats the Hub as the loading escape destination", () => {
    expect(isHubLoadingTarget(CHAMBER_ROOM_ID)).toBe(true);
  });

  it("offers an escape from Commons and unknown resume targets", () => {
    expect(isHubLoadingTarget(HUB_ROOM_ID)).toBe(false);
    expect(isHubLoadingTarget(null)).toBe(false);
  });
});

describe("createLoadingFeedbackController", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function makeController() {
    const onRevealSpinner = vi.fn();
    const onRevealReturnToHub = vi.fn();
    const onReset = vi.fn();
    const controller = createLoadingFeedbackController({
      onRevealSpinner,
      onRevealReturnToHub,
      onReset,
    });
    return { controller, onRevealSpinner, onRevealReturnToHub, onReset };
  }

  it("keeps a blackout load cinematic until the spinner delay, then shows Return to Hub", () => {
    vi.useFakeTimers();
    const { controller, onRevealSpinner, onRevealReturnToHub } = makeController();
    controller.start({ targetRoomId: HUB_ROOM_ID, blackout: true });

    vi.advanceTimersByTime(LOADING_SPINNER_REVEAL_MS - 1);
    expect(onRevealSpinner).not.toHaveBeenCalled();
    expect(onRevealReturnToHub).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onRevealSpinner).toHaveBeenCalledOnce();

    vi.advanceTimersByTime(LOADING_RETURN_TO_HUB_MS - LOADING_SPINNER_REVEAL_MS - 1);
    expect(onRevealReturnToHub).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onRevealReturnToHub).toHaveBeenCalledOnce();
    controller.stop();
  });

  it("does not offer Return to Hub while already loading the Hub", () => {
    vi.useFakeTimers();
    const { controller, onRevealSpinner, onRevealReturnToHub } = makeController();
    controller.start({ targetRoomId: CHAMBER_ROOM_ID, blackout: true });

    vi.advanceTimersByTime(LOADING_RETURN_TO_HUB_MS + 1_000);
    expect(onRevealSpinner).toHaveBeenCalledOnce();
    expect(onRevealReturnToHub).not.toHaveBeenCalled();
    controller.stop();
  });

  it("offers Return to Hub when the resume room is not known yet", () => {
    vi.useFakeTimers();
    const { controller, onRevealReturnToHub } = makeController();
    controller.start({ targetRoomId: null, blackout: true });

    vi.advanceTimersByTime(LOADING_RETURN_TO_HUB_MS);
    expect(onRevealReturnToHub).toHaveBeenCalledOnce();
    controller.stop();
  });

  it("skips the spinner delay when the overlay already shows loading chrome", () => {
    vi.useFakeTimers();
    const { controller, onRevealSpinner, onRevealReturnToHub } = makeController();
    controller.start({ targetRoomId: HUB_ROOM_ID, blackout: false });

    vi.advanceTimersByTime(LOADING_SPINNER_REVEAL_MS);
    expect(onRevealSpinner).not.toHaveBeenCalled();

    vi.advanceTimersByTime(LOADING_RETURN_TO_HUB_MS - LOADING_SPINNER_REVEAL_MS);
    expect(onRevealReturnToHub).toHaveBeenCalledOnce();
    controller.stop();
  });

  it("ensureStarted does not reset an in-flight blackout clock", () => {
    vi.useFakeTimers();
    const { controller, onRevealSpinner } = makeController();
    controller.start({ targetRoomId: HUB_ROOM_ID, blackout: true });
    vi.advanceTimersByTime(LOADING_SPINNER_REVEAL_MS - 200);
    controller.ensureStarted({ targetRoomId: HUB_ROOM_ID, blackout: true });
    vi.advanceTimersByTime(200);
    expect(onRevealSpinner).toHaveBeenCalledOnce();
    controller.stop();
  });

  it("stop cancels pending reveals and resets the overlay escape", () => {
    vi.useFakeTimers();
    const { controller, onRevealSpinner, onRevealReturnToHub, onReset } =
      makeController();
    controller.start({ targetRoomId: HUB_ROOM_ID, blackout: true });
    controller.stop();
    vi.advanceTimersByTime(LOADING_RETURN_TO_HUB_MS);
    expect(onRevealSpinner).not.toHaveBeenCalled();
    expect(onRevealReturnToHub).not.toHaveBeenCalled();
    expect(onReset).toHaveBeenCalledOnce();
  });
});
