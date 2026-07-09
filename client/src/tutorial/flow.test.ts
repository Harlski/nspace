import { describe, it, expect, vi, afterEach } from "vitest";
import {
  TutorialEscapeTimer,
  TUTORIAL_ESCAPE_COUNTDOWN_MS,
  TUTORIAL_ESCAPE_MS,
  shouldShowFinishTutorialMenu,
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
});
