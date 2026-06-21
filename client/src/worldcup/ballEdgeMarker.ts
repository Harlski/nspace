/**
 * World Cup soccer — Ball Edge Marker HUD (CLIENT-ONLY, FEATURE-FLAGGED, DEPRECATABLE).
 *
 * A screen-edge chevron pointing toward the ball when it is off the letterboxed game
 * viewport. Opacity scales with how far past the edge the ball sits. Active players on
 * the Free Play Field or a Match Pitch only — never Spectators. To deprecate, delete this
 * file and the `worldcup`-tagged hooks in `main.ts` / `Game.ts`.
 */
import {
  computeBallEdgeMarkerPlacement,
  type BallScreen,
  type Viewport,
} from "./ballEdgeMarkerGeometry.js";

export class WorldcupBallEdgeMarker {
  private readonly root: HTMLDivElement;
  private readonly chevron: HTMLDivElement;

  /**
   * @param parent the `.letterbox` game area (same mount as scoreboard / match HUD).
   */
  constructor(parent?: HTMLElement) {
    const root = document.createElement("div");
    root.style.cssText =
      "position:absolute;inset:0;z-index:58;display:none;pointer-events:none;overflow:hidden;";

    const chevron = document.createElement("div");
    chevron.textContent = "›";
    chevron.style.cssText =
      "position:absolute;left:0;top:0;width:28px;height:28px;margin:-14px 0 0 -14px;" +
      "display:flex;align-items:center;justify-content:center;" +
      "font-size:1.65rem;font-weight:800;line-height:1;color:#fff;" +
      "text-shadow:0 0 6px rgba(0,0,0,0.85),0 2px 8px rgba(0,0,0,0.55);" +
      "transform-origin:50% 50%;opacity:0;transition:opacity 0.06s linear;";
    root.appendChild(chevron);

    (parent ?? document.body).appendChild(root);
    this.root = root;
    this.chevron = chevron;
  }

  hide(): void {
    this.root.style.display = "none";
    this.chevron.style.opacity = "0";
  }

  /** Update marker from canvas-local ball screen coords; hides when ball is on-screen. */
  update(ball: BallScreen | null, viewport: Viewport): void {
    if (!ball) {
      this.hide();
      return;
    }
    const placement = computeBallEdgeMarkerPlacement(ball, viewport);
    if (!placement) {
      this.hide();
      return;
    }
    this.root.style.display = "block";
    this.chevron.style.left = `${placement.edgeX}px`;
    this.chevron.style.top = `${placement.edgeY}px`;
    this.chevron.style.transform = `rotate(${placement.angleDeg}deg)`;
    this.chevron.style.opacity = String(placement.opacity);
  }
}
