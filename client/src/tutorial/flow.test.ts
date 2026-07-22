import { describe, it, expect, vi, afterEach } from "vitest";
import {
  TutorialEscapeTimer,
  TUTORIAL_ESCAPE_COUNTDOWN_MS,
  TUTORIAL_ESCAPE_MS,
  TUTORIAL_WRONG_SLOT_REASON,
  TUTORIAL_ALREADY_CLAIMED_REASON,
  canSimulateTutorialDoorPayment,
  deriveTutorialCoachState,
  isStandingOnTutorialGateApproach,
  parseTutorialMineTileCoords,
  sendTutorialDoorPayment,
  shouldOfferTutorialUnlockGate,
  shouldShowFinishTutorialMenu,
  resolveTutorialAttentionTarget,
  resolveTutorialAttentionTargets,
  withTutorialMineCompleted,
  shouldShowTutorialMineHighlight,
  shouldShowTutorialResetMenu,
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

describe("withTutorialMineCompleted", () => {
  it("advances sandbox welcome to Pay and restores lessonMode after Reset", () => {
    const next = withTutorialMineCompleted(
      {
        needsTutorial: false,
        mode: "sandbox",
        lessonMode: false,
      },
      42
    );
    expect(next.session).toEqual({ mineCompletedAt: 42, lastStep: "pay" });
    expect(next.mode).toBe("lesson");
    expect(next.lessonMode).toBe(true);
    expect(
      deriveTutorialCoachState(next, "tutorial")?.current
    ).toBe("pay");
    expect(shouldOfferTutorialUnlockGate(next)).toBe(true);
  });

  it("is a no-op when mine is already complete in lesson mode", () => {
    const welcome = {
      needsTutorial: true,
      mode: "lesson" as const,
      lessonMode: true,
      session: { mineCompletedAt: 1, lastStep: "pay" as const },
    };
    expect(withTutorialMineCompleted(welcome, 99)).toBe(welcome);
  });
});

describe("Tutorial Step Coach", () => {
  it("shows coach in sandbox and after completion while in Tutorial Room", () => {
    expect(
      shouldShowTutorialStepCoach(
        {
          needsTutorial: false,
          mode: "sandbox",
          lessonMode: false,
        },
        "tutorial"
      )
    ).toBe(true);
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
    ).toBe(true);
    const done = deriveTutorialCoachState(
      {
        needsTutorial: false,
        mode: "sandbox",
        lessonMode: false,
        completedAt: 1,
        session: { mineCompletedAt: 1, doorPaidAt: 2 },
      },
      "tutorial"
    );
    expect(done?.current).toBe("exit");
    expect(done?.completed).toEqual(["mine", "pay", "exit"]);
    expect(done?.hint).toMatch(/complete/i);
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

  it("shows mid-lesson progress after sandbox teleporter revisit", () => {
    const state = deriveTutorialCoachState(
      {
        needsTutorial: true,
        mode: "sandbox",
        lessonMode: false,
        session: { mineCompletedAt: 1 },
      },
      "tutorial"
    );
    expect(state?.current).toBe("pay");
    expect(state?.completed).toEqual(["mine"]);
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
      hint: "Click and hold a glowing gold block to receive NIM.",
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
      "Stand beside the Unlock Pad and tap Unlock."
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
    expect(state?.hint).toBe(
      "Walk through the open pad and Enter the Exit Teleporter."
    );
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

describe("resolveTutorialAttentionTargets", () => {
  const layout = {
    mineTiles: [
      { x: -1, z: -5 },
      { x: 0, z: -5 },
      { x: 1, z: -5 },
    ],
    unlockPadTiles: [
      { x: 0, z: 0 },
      { x: 1, z: 0 },
    ],
    exitTile: { x: 0, z: 1 },
  };

  it("marks every gold mine on Mine", () => {
    expect(
      resolveTutorialAttentionTargets(
        {
          needsTutorial: true,
          mode: "lesson",
          lessonMode: true,
          mineTile: "0,-5,0",
        },
        "tutorial",
        layout
      )
    ).toEqual([
      { x: -1, z: -5 },
      { x: 0, z: -5 },
      { x: 1, z: -5 },
    ]);
  });

  it("marks every Unlock Pad on Pay", () => {
    expect(
      resolveTutorialAttentionTargets(
        {
          needsTutorial: true,
          mode: "lesson",
          lessonMode: true,
          session: { mineCompletedAt: 1 },
        },
        "tutorial",
        layout
      )
    ).toEqual([
      { x: 0, z: 0 },
      { x: 1, z: 0 },
    ]);
  });

  it("points at the Hub exit on Exit", () => {
    expect(
      resolveTutorialAttentionTargets(
        {
          needsTutorial: true,
          mode: "lesson",
          lessonMode: true,
          session: { mineCompletedAt: 1, doorPaidAt: 2 },
        },
        "tutorial",
        layout
      )
    ).toEqual([{ x: 0, z: 1 }]);
  });

  it("hides after lesson completion and outside Tutorial Room", () => {
    expect(
      resolveTutorialAttentionTargets(
        {
          needsTutorial: false,
          mode: "sandbox",
          lessonMode: false,
          completedAt: 1,
          session: { mineCompletedAt: 1, doorPaidAt: 2 },
        },
        "tutorial",
        layout
      )
    ).toEqual([]);
    expect(
      resolveTutorialAttentionTargets(
        {
          needsTutorial: true,
          mode: "lesson",
          lessonMode: true,
        },
        "hub",
        layout
      )
    ).toEqual([]);
  });
});

describe("Tutorial Unlock Gate offer", () => {
  it("offers Unlock Gate after mine and before pay/escape (incl. post-Reset sandbox)", () => {
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
    // After Reset, welcome can arrive as sandbox; still offer Unlock while teaching.
    expect(
      shouldOfferTutorialUnlockGate({
        needsTutorial: true,
        mode: "sandbox",
        lessonMode: false,
        session: { mineCompletedAt: 1 },
      })
    ).toBe(true);
    expect(
      shouldOfferTutorialUnlockGate({
        needsTutorial: false,
        mode: "sandbox",
        lessonMode: false,
        completedAt: 9,
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

describe("Tutorial reset menu", () => {
  it("hides for non-admins even when the feature is on", () => {
    expect(
      shouldShowTutorialResetMenu({
        inTutorialRoom: true,
        isAdmin: false,
        tutorialFeatureEnabled: true,
      })
    ).toBe(false);
    expect(
      shouldShowTutorialResetMenu({
        inTutorialRoom: true,
        isAdmin: false,
        tutorialFeatureEnabled: false,
      })
    ).toBe(false);
    expect(
      shouldShowTutorialResetMenu({
        inTutorialRoom: false,
        isAdmin: false,
        tutorialFeatureEnabled: true,
      })
    ).toBe(false);
  });

  it("shows for admins in Tutorial Room even when the feature is off", () => {
    expect(
      shouldShowTutorialResetMenu({
        inTutorialRoom: true,
        isAdmin: true,
        tutorialFeatureEnabled: false,
      })
    ).toBe(true);
    expect(
      shouldShowTutorialResetMenu({
        inTutorialRoom: false,
        isAdmin: true,
        tutorialFeatureEnabled: false,
      })
    ).toBe(false);
  });
});

describe("sendTutorialDoorPayment", () => {
  afterEach(() => {
    delete (window as { nimiqPay?: unknown }).nimiqPay;
  });

  it("simulates Pay when host send API is missing in DEV", async () => {
    expect(canSimulateTutorialDoorPayment()).toBe(true);
    delete (window as { nimiqPay?: unknown }).nimiqPay;
    const escape = new TutorialEscapeTimer({});
    const result = await sendTutorialDoorPayment({
      quote: {
        amountLuna: "1000",
        amountNim: "0.0100",
        recipient: "NQ32 FRGN PDKF RC4Y CKLV 4K3F PKL1 UBAU 7U71",
        memo: "tutorial-door:test",
      },
      escape,
    });
    expect(result).toEqual({ ok: true, simulated: true });
  });

  it("uses real Pay send when available", async () => {
    const send = vi.fn(async () => undefined);
    window.nimiqPay = { sendBasicTransactionWithData: send };
    const escape = new TutorialEscapeTimer({});
    const result = await sendTutorialDoorPayment({
      quote: {
        amountLuna: "1000",
        amountNim: "0.0100",
        recipient: "NQ32 FRGN PDKF RC4Y CKLV 4K3F PKL1 UBAU 7U71",
        memo: "tutorial-door:test",
      },
      escape,
    });
    expect(result).toEqual({ ok: true });
    expect(send).toHaveBeenCalledOnce();
  });
});
