/**
 * World Cup soccer — floating on-screen touch joystick VISUAL (CLIENT-ONLY, FEATURE-FLAGGED).
 *
 * A left-thumb virtual stick for moving on the pitch from a touch device / Nimiq Pay mini-app,
 * where precise tap-to-move is fiddly. It coexists with tap-to-move: a quick stationary tap still
 * walks, while a single-finger drag past a small threshold summons this stick *where the thumb
 * went down* and steers from there. To keep one pointer pipeline, the tap-vs-drag gesture and the
 * throttled emit live in `Game.ts`; this class is a dumb visual the game positions and updates:
 *   - `showAt(clientX, clientY)` materializes the base centred on the thumb-down point,
 *   - `moveThumbTo(clientX, clientY)` moves the thumb (clamped) and returns the normalized
 *     deflection (−1..1, y down) for the game to convert into a heading,
 *   - `hide()` removes it on release.
 * To deprecate, delete this file and the `worldcup`-tagged hooks in `main.ts` / `Game.ts`.
 */

const BASE_PX = 132;
const THUMB_PX = 56;

export interface WorldcupJoystickView {
  showAt(clientX: number, clientY: number): void;
  moveThumbTo(clientX: number, clientY: number): { dx: number; dy: number };
  hide(): void;
}

export class WorldcupJoystick implements WorldcupJoystickView {
  private readonly base: HTMLDivElement;
  private readonly thumb: HTMLDivElement;
  /** Screen-space centre of the base while shown (the thumb-down anchor). */
  private cx = 0;
  private cy = 0;

  constructor() {
    const base = document.createElement("div");
    base.style.cssText =
      `position:fixed;left:0;top:0;width:${BASE_PX}px;height:${BASE_PX}px;` +
      "border-radius:50%;z-index:55;display:none;pointer-events:none;touch-action:none;" +
      "background:radial-gradient(circle at 50% 50%,rgba(255,255,255,0.10),rgba(10,12,18,0.30));" +
      "border:1px solid rgba(255,255,255,0.18);box-shadow:0 6px 22px rgba(0,0,0,0.3);" +
      "transition:opacity 0.08s linear;opacity:0;";
    const thumb = document.createElement("div");
    thumb.style.cssText =
      `position:absolute;left:50%;top:50%;width:${THUMB_PX}px;height:${THUMB_PX}px;` +
      "margin-left:-" + THUMB_PX / 2 + "px;margin-top:-" + THUMB_PX / 2 + "px;border-radius:50%;" +
      "background:radial-gradient(circle at 40% 35%,#eaf6ff,#8fb4c9);" +
      "border:1px solid rgba(255,255,255,0.6);box-shadow:0 3px 10px rgba(0,0,0,0.35);" +
      "transition:transform 0.02s linear;";
    base.appendChild(thumb);
    this.base = base;
    this.thumb = thumb;
    document.body.appendChild(base);
  }

  showAt(clientX: number, clientY: number): void {
    this.cx = clientX;
    this.cy = clientY;
    this.base.style.left = `${clientX - BASE_PX / 2}px`;
    this.base.style.top = `${clientY - BASE_PX / 2}px`;
    this.thumb.style.transform = "translate(0px, 0px)";
    this.base.style.display = "block";
    // Next frame so the opacity transition runs (display:none skips transitions).
    requestAnimationFrame(() => {
      this.base.style.opacity = "1";
    });
  }

  moveThumbTo(clientX: number, clientY: number): { dx: number; dy: number } {
    const radius = BASE_PX / 2;
    const max = radius - THUMB_PX / 4;
    let ox = clientX - this.cx;
    let oy = clientY - this.cy;
    const len = Math.hypot(ox, oy);
    if (len > max && len > 0) {
      ox = (ox / len) * max;
      oy = (oy / len) * max;
    }
    this.thumb.style.transform = `translate(${ox}px, ${oy}px)`;
    return { dx: ox / max, dy: oy / max };
  }

  hide(): void {
    this.base.style.opacity = "0";
    this.base.style.display = "none";
    this.thumb.style.transform = "translate(0px, 0px)";
  }

  destroy(): void {
    this.base.remove();
  }
}
