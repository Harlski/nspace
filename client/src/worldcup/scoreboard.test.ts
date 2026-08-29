import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTranslator, setSharedTranslator, t } from "@nspace/i18n";

import { WorldcupScoreboard } from "./scoreboard.js";

const COUNTRIES = [
  { code: "BR", goals: 5 },
  { code: "DE", goals: 2 },
  { code: "JP", goals: 1 },
];

function byAria(label: string): HTMLElement | null {
  return (
    [...document.querySelectorAll("[aria-label]")].find(
      (el) => el.getAttribute("aria-label") === label
    ) ?? null
  ) as HTMLElement | null;
}

function chip(): HTMLElement | null {
  return byAria(t("worldcup.scoreboardChipAria"));
}

function modal(): HTMLElement | null {
  return byAria(t("worldcup.leaderboardTitle"));
}

describe("WorldcupScoreboard chip layout", () => {
  let board: WorldcupScoreboard | null = null;

  beforeEach(() => {
    setSharedTranslator(createTranslator("en"));
  });

  afterEach(() => {
    board?.destroy();
    board = null;
    document.body.replaceChildren();
  });

  function mountChip(opts?: {
    usesChip?: () => boolean;
    overlayBack?: {
      push: (id: string, onPop: () => boolean | void) => void;
      dismiss: (id: string) => void;
    };
  }): WorldcupScoreboard {
    const parent = document.createElement("div");
    document.body.appendChild(parent);
    board = new WorldcupScoreboard(parent, {
      usesChip: opts?.usesChip ?? (() => true),
      overlayBack: opts?.overlayBack,
    });
    board.setVisible(true);
    return board;
  }

  function mountPanel(): WorldcupScoreboard {
    const parent = document.createElement("div");
    document.body.appendChild(parent);
    board = new WorldcupScoreboard(parent, { usesChip: () => false });
    board.setVisible(true);
    return board;
  }

  it("shows only the leading country as a compact 1. flag goals chip", () => {
    const sb = mountChip();
    sb.setLeaderboard(COUNTRIES);

    expect(chip()).toBeInstanceOf(HTMLElement);
    expect(chip()?.textContent).toMatch(/1\./);
    expect(chip()?.textContent).toContain("5");
    expect(chip()?.querySelector('img[alt="BR"]')).not.toBeNull();
    expect(document.body.textContent).not.toContain("Germany");
    expect(document.body.textContent).not.toContain("Japan");
  });

  it("opens the leaderboard modal from the chip with the full ranking", () => {
    const sb = mountChip();
    sb.setLeaderboard(COUNTRIES);

    expect(chip()).toBeInstanceOf(HTMLElement);
    chip()?.click();

    expect(modal()).toBeInstanceOf(HTMLElement);
    expect(modal()?.textContent).toContain("Brazil");
    expect(modal()?.textContent).toContain("Germany");
    expect(modal()?.textContent).toContain("Japan");
    expect(modal()?.textContent).toMatch(/1/);
    expect(modal()?.querySelector('img[alt="BR"]')).not.toBeNull();
  });

  it("closes the leaderboard modal from the close control", () => {
    const sb = mountChip();
    sb.setLeaderboard(COUNTRIES);
    chip()?.click();

    const close = byAria(t("worldcup.leaderboardClose"));
    expect(close).toBeInstanceOf(HTMLElement);
    close?.click();

    expect(modal()).toBeNull();
  });

  it("closes the leaderboard modal on Escape and backdrop press", () => {
    const sb = mountChip();
    sb.setLeaderboard(COUNTRIES);
    chip()?.click();
    expect(modal()).toBeInstanceOf(HTMLElement);

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(modal()).toBeNull();

    chip()?.click();
    modal()?.click();
    expect(modal()).toBeNull();
  });

  it("asks overlay back to close the leaderboard modal", () => {
    const overlayBack = {
      push: vi.fn(),
      dismiss: vi.fn(),
    };
    const sb = mountChip({ overlayBack });
    sb.setLeaderboard(COUNTRIES);
    chip()?.click();

    expect(overlayBack.push).toHaveBeenCalledWith(
      "worldcup-leaderboard",
      expect.any(Function)
    );
    byAria(t("worldcup.leaderboardClose"))?.click();
    expect(overlayBack.dismiss).toHaveBeenCalledWith("worldcup-leaderboard");
  });

  it("closes the leaderboard modal when the layout switches to the desktop panel", () => {
    let useChip = true;
    const sb = mountChip({ usesChip: () => useChip });
    sb.setLeaderboard(COUNTRIES);
    chip()?.click();
    expect(modal()).toBeInstanceOf(HTMLElement);

    useChip = false;
    window.dispatchEvent(new Event("resize"));

    expect(modal()).toBeNull();
    expect(chip()).toBeNull();
    expect(document.body.textContent).toContain("Brazil");
  });

  it("still lists countries inline on the desktop panel", () => {
    const sb = mountPanel();
    sb.setLeaderboard(COUNTRIES);

    expect(chip()).toBeNull();
    expect(document.body.textContent).toContain("Brazil");
    expect(document.body.textContent).toContain("Germany");
    expect(document.body.textContent).toContain("Japan");
  });

  it("does not open the leaderboard when the country picker button is pressed", () => {
    const sb = mountChip();
    sb.setLeaderboard(COUNTRIES);

    const picker = document.querySelector(
      '[title="Pick your country"]'
    ) as HTMLElement | null;
    expect(picker).toBeInstanceOf(HTMLElement);
    picker?.click();

    expect(modal()).toBeNull();
  });
});
