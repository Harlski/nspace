import { describe, it, expect, vi, afterEach } from "vitest";
import {
  TutorialEscapeTimer,
  TUTORIAL_ESCAPE_COUNTDOWN_MS,
  TUTORIAL_ESCAPE_MS,
  TUTORIAL_WRONG_SLOT_REASON,
  TUTORIAL_ALREADY_CLAIMED_REASON,
  deriveTutorialCoachState,
  isStandingOnTutorialGateApproach,
  parseTutorialMineTileCoords,
  shouldOfferTutorialUnlockGate,
  shouldShowFinishTutorialMenu,
  shouldShowTutorialMineHighlight,
  shouldShowTutorialStepCoach,
  tutorialGateApproachTile,
  tutorialSuppressesSocial,
} from "./flow.js";

describe("TutorialEscapeTimer", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("arms only during pending window and fires after escape ms", () => {
    vi.useFakeTimers();
    let fired = false;
    const timer = new TutorialEscapeTimer({
      onEscapeFire: () => {
        fired = true;
      },
    });
    timer.arm();
    vi.advanceTimersByTime(TUTORIAL_ESCAPE_MS - 1);
    expect(fired).toBe(false);
    vi.advanceTimersByTime(1);
    expect(fired).toBe(true);
  });

  it("disarm cancels escape", () => {
    vi.useFakeTimers();
    let fired = false;
    const timer = new TutorialEscapeTimer({
      onEscapeFire: () => {
        fired = true;
      },
    });
    timer.arm();
    vi.advanceTimersByTime(TUTORIAL_ESCAPE_MS / 2);
    timer.disarm();
    vi.advanceTimersByTime(TUTORIAL_ESCAPE_MS);
    expect(fired).toBe(false);
  });

  it("shows countdown only in the last countdown window", () => {
    vi.useFakeTimers();
    const seen: number[] = [];
    const timer = new TutorialEscapeTimer({
      onEscapeCountdown: (s) => seen.push(s),
    });
    timer.arm();
    vi.advanceTimersByTime(
      TUTORIAL_ESCAPE_MS - TUTORIAL_ESCAPE_COUNTDOWN_MS - 100
    );
    expect(seen.length).toBe(0);
    vi.advanceTimersByTime(TUTORIAL_ESCAPE_COUNTDOWN_MS);
    expect(seen.length).toBeGreaterThan(0);
  });
});

describe("tutorial menu and lesson flags", () => {
  it("hides Finish tutorial when completed", () => {
    expect(
      shouldShowFinishTutorialMenu(true, {
        needsTutorial: false,
        mode: "sandbox",
        completedAt: 1,
      })
    ).toBe(false);
  });

  it("lesson mode suppresses chat send", () => {
    expect(
      tutorialSuppressesSocial({
        needsTutorial: true,
        mode: "lesson",
        lessonMode: true,
      })
    ).toBe(true);
    expect(
      tutorialSuppressesSocial({
        needsTutorial: false,
        mode: "sandbox",
        lessonMode: false,
      })
    ).toBe(false);
  });

  it("parses mine tile block keys to floor coords", () => {
    expect(parseTutorialMineTileCoords("-2,0,0")).toEqual({ x: -2, z: 0 });
    expect(parseTutorialMineTileCoords("bad")).toBeNull();
  });

  it("shows mine highlight only before mine completes", () => {
    expect(
      shouldShowTutorialMineHighlight({
        needsTutorial: true,
        mode: "lesson",
        lessonMode: true,
        mineTile: "0,0,0",
      })
    ).toBe(true);
    expect(
      shouldShowTutorialMineHighlight({
        needsTutorial: true,
        mode: "lesson",
        lessonMode: true,
        mineTile: "0,0,0",
        session: { mineCompletedAt: 1 },
      })
    ).toBe(false);
  });
});

describe("Tutorial Step Coach", () => {
  it("hides coach in sandbox and after completion", () => {
    expect(
      shouldShowTutorialStepCoach(
        {
          needsTutorial: false,
          mode: "sandbox",
          lessonMode: false,
        },
        "tutorial"
      )
    ).toBe(false);
    expect(
      shouldShowTutorialStepCoach(
        {
          needsTutorial: false,
          mode: "lesson",
          lessonMode: true,
          completedAt: 1,
        },
        "tutorial"
      )
    ).toBe(false);
    expect(deriveTutorialCoachState(undefined, "tutorial")).toBeNull();
  });

  it("hides coach outside the Tutorial Room", () => {
    const lesson = {
      needsTutorial: true,
      mode: "lesson" as const,
      lessonMode: true,
    };
    expect(shouldShowTutorialStepCoach(lesson, "chamber")).toBe(false);
    expect(shouldShowTutorialStepCoach(lesson, "hub")).toBe(false);
    expect(deriveTutorialCoachState(lesson, "chamber")).toBeNull();
    expect(shouldShowTutorialStepCoach(lesson, "tutorial")).toBe(true);
  });

  it("starts on Mine with mine hint", () => {
    const state = deriveTutorialCoachState(
      {
        needsTutorial: true,
        mode: "lesson",
        lessonMode: true,
      },
      "tutorial"
    );
    expect(state).toEqual({
      visible: true,
      current: "mine",
      completed: [],
      hint: "Click and hold your glowing block to receive NIM.",
    });
  });

  it("advances to Pay after mine completes", () => {
    const state = deriveTutorialCoachState(
      {
        needsTutorial: true,
        mode: "lesson",
        lessonMode: true,
        session: { mineCompletedAt: 1 },
      },
      "tutorial"
    );
    expect(state?.current).toBe("pay");
    expect(state?.completed).toEqual(["mine"]);
    expect(state?.hint).toBe(
      "Stand beside the Unlock Pad and tap Unlock Pad."
    );
  });

  it("advances to Exit after Pay ack", () => {
    const state = deriveTutorialCoachState(
      {
        needsTutorial: true,
        mode: "lesson",
        lessonMode: true,
        session: { mineCompletedAt: 1, doorPaidAt: 2 },
      },
      "tutorial"
    );
    expect(state?.current).toBe("exit");
    expect(state?.completed).toEqual(["mine", "pay"]);
    expect(state?.hint).toBe("Walk through the open gate to the Hub.");
  });

  it("treats Tutorial Escape as completing Pay", () => {
    const state = deriveTutorialCoachState(
      {
        needsTutorial: true,
        mode: "lesson",
        lessonMode: true,
        session: { mineCompletedAt: 1, gateUnstuckAt: 2 },
      },
      "tutorial"
    );
    expect(state?.current).toBe("exit");
    expect(state?.completed).toEqual(["mine", "pay"]);
  });

  it("exports wrong-slot redirect copy", () => {
    expect(TUTORIAL_WRONG_SLOT_REASON).toBe(
      "Click and hold your glowing block."
    );
  });

  it("exports already-claimed copy", () => {
    expect(TUTORIAL_ALREADY_CLAIMED_REASON).toBe(
      "You already mined your tutorial block."
    );
  });
});

describe("Tutorial Unlock Gate offer", () => {
  it("offers Unlock Gate only after mine and before pay/escape", () => {
    expect(
      shouldOfferTutorialUnlockGate({
        needsTutorial: true,
        mode: "lesson",
        lessonMode: true,
        session: { mineCompletedAt: 1 },
      })
    ).toBe(true);
    expect(
      shouldOfferTutorialUnlockGate({
        needsTutorial: true,
        mode: "lesson",
        lessonMode: true,
        session: {},
      })
    ).toBe(false);
    expect(
      shouldOfferTutorialUnlockGate({
        needsTutorial: true,
        mode: "lesson",
        lessonMode: true,
        session: { mineCompletedAt: 1, doorPaidAt: 2 },
      })
    ).toBe(false);
    expect(
      shouldOfferTutorialUnlockGate({
        needsTutorial: true,
        mode: "sandbox",
        lessonMode: false,
        session: { mineCompletedAt: 1 },
      })
    ).toBe(false);
  });

  it("maps gate approach tile opposite the exit", () => {
    expect(tutorialGateApproachTile(0, 0, 0, 1)).toEqual({ x: 0, z: -1 });
    expect(tutorialGateApproachTile(3, -2, 3, -1)).toEqual({ x: 3, z: -3 });
  });

  it("detects standing on the approach tile", () => {
    expect(
      isStandingOnTutorialGateApproach(
        { x: 0, z: -1 },
        { gateX: 0, gateZ: 0, exitX: 0, exitZ: 1 }
      )
    ).toBe(true);
    expect(
      isStandingOnTutorialGateApproach(
        { x: 0, z: 1 },
        { gateX: 0, gateZ: 0, exitX: 0, exitZ: 1 }
      )
    ).toBe(false);
  });
});
