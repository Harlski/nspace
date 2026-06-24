/**
 * World Cup soccer — Pitch Movement Mode toggle (CLIENT-ONLY, FEATURE-FLAGGED).
 *
 * Small experimental control for touch / Nimiq Pay hosts on the Free Play Field or a Match
 * Pitch (active players only). Switches Pitch Movement Mode between Tap and Joystick; choice
 * persists in localStorage. Stacks under the top HUD chrome, below the Match HUD bar when present.
 */

export type PitchMovementMode = "tap" | "joystick";

const STORAGE_KEY = "nspace.worldcup.pitchMoveMode";

export function loadPitchMovementMode(): PitchMovementMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "tap" || v === "joystick") return v;
  } catch {
    /* private mode / quota */
  }
  return "tap";
}

export function savePitchMovementMode(mode: PitchMovementMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    /* ignore */
  }
}

function modeLabel(mode: PitchMovementMode): string {
  return mode === "tap" ? "Tap" : "Stick";
}

function modeTooltip(mode: PitchMovementMode): string {
  return mode === "tap"
    ? "Experimental: Tap to move"
    : "Experimental: Joystick only";
}

export class WorldcupMovementModeToggle {
  private readonly root: HTMLDivElement;
  private readonly btn: HTMLButtonElement;
  private mode: PitchMovementMode = "tap";
  private stackEl: HTMLElement | null = null;
  private stackObserver: ResizeObserver | null = null;
  private topWrapObserver: ResizeObserver | null = null;

  /** Fired after the user picks a new mode (persist in the host). */
  onChange: (mode: PitchMovementMode) => void = () => {};

  /**
   * @param parent the `.letterbox` game area (same mount as Match HUD / scoreboard).
   */
  constructor(parent?: HTMLElement) {
    const root = document.createElement("div");
    root.className = "worldcup-move-mode-toggle";
    root.style.cssText =
      "position:absolute;left:12px;z-index:61;display:none;pointer-events:auto;";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.style.cssText =
      "border:1px solid rgba(255,255,255,0.18);background:rgba(15,17,23,0.82);" +
      "border-radius:8px;padding:0.22rem 0.55rem;font-size:0.72rem;font-weight:700;" +
      "cursor:pointer;color:#f4f5f7;font-family:inherit;letter-spacing:0.02em;" +
      "box-shadow:0 2px 12px rgba(0,0,0,0.28);backdrop-filter:blur(8px);";
    btn.addEventListener("click", () => {
      const next: PitchMovementMode = this.mode === "tap" ? "joystick" : "tap";
      this.setMode(next);
      this.onChange(next);
    });
    root.appendChild(btn);
    (parent ?? document.body).appendChild(root);
    this.root = root;
    this.btn = btn;

    this.setMode("tap");
    this.observeTopWrap();
    this.applyTop();
  }

  setMode(mode: PitchMovementMode): void {
    this.mode = mode;
    this.btn.textContent = modeLabel(mode);
    this.btn.title = modeTooltip(mode);
  }

  setVisible(visible: boolean): void {
    this.root.style.display = visible ? "block" : "none";
    if (visible) this.applyTop();
  }

  /** Match HUD bar to stack beneath; null on the Free Play Field or when the bar is hidden. */
  setStackBelow(el: HTMLElement | null): void {
    if (this.stackEl === el) return;
    this.stackObserver?.disconnect();
    this.stackObserver = null;
    this.stackEl = el;
    if (el && "ResizeObserver" in window) {
      this.stackObserver = new ResizeObserver(() => this.applyTop());
      this.stackObserver.observe(el);
    }
    this.applyTop();
  }

  private observeTopWrap(): void {
    const topWrap = document.querySelector<HTMLElement>(".hud-top-wrap");
    const apply = (): void => this.applyTop();
    apply();
    if (topWrap && "ResizeObserver" in window) {
      this.topWrapObserver = new ResizeObserver(apply);
      this.topWrapObserver.observe(topWrap);
    }
    window.addEventListener("resize", apply);
  }

  private applyTop(): void {
    const topWrap = document.querySelector<HTMLElement>(".hud-top-wrap");
    const h = topWrap?.offsetHeight ?? 52;
    document.documentElement.style.setProperty("--hud-below-top-wrap", `${h}px`);
    const gap = 8;
    const stackH =
      this.stackEl && this.stackEl.offsetHeight > 0
        ? this.stackEl.offsetHeight
        : 0;
    this.root.style.top = `${h + stackH + gap}px`;
  }
}
