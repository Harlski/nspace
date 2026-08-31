/**
 * Mosquito Tag — Participant Edge Marker HUD.
 *
 * Screen-edge chevrons pointing toward off-screen Participants. Placement reuses
 * Ball Edge Marker geometry. Shown only to Participants during Tag Countdown and
 * Tag Round. Holder chevron is amber; others match the Participant Marker green.
 */
import { computeBallEdgeMarkerPlacement } from "../worldcup/ballEdgeMarkerGeometry.js";
import type { Viewport } from "../worldcup/ballEdgeMarkerGeometry.js";

export type ParticipantEdgeScreen = {
  x: number;
  y: number;
  radius: number;
  isHolder: boolean;
};

const HOLDER_COLOR = "#facc15";
const RUNNER_COLOR = "#4ade80";

export class TagParticipantEdgeMarkers {
  private readonly root: HTMLDivElement;
  private readonly chevrons: HTMLDivElement[] = [];

  constructor(parent?: HTMLElement) {
    const root = document.createElement("div");
    root.style.cssText =
      "position:absolute;inset:0;z-index:57;display:none;pointer-events:none;overflow:hidden;";
    (parent ?? document.body).appendChild(root);
    this.root = root;
  }

  hide(): void {
    this.root.style.display = "none";
    for (const el of this.chevrons) el.style.opacity = "0";
  }

  update(screens: ParticipantEdgeScreen[], viewport: Viewport): void {
    const placements: Array<{
      edgeX: number;
      edgeY: number;
      angleDeg: number;
      opacity: number;
      isHolder: boolean;
    }> = [];
    for (const screen of screens) {
      const placement = computeBallEdgeMarkerPlacement(screen, viewport);
      if (!placement) continue;
      placements.push({ ...placement, isHolder: screen.isHolder });
    }
    if (placements.length === 0) {
      this.hide();
      return;
    }
    this.root.style.display = "block";
    while (this.chevrons.length < placements.length) {
      this.chevrons.push(this.makeChevron());
    }
    for (let i = 0; i < this.chevrons.length; i++) {
      const el = this.chevrons[i]!;
      const p = placements[i];
      if (!p) {
        el.style.opacity = "0";
        continue;
      }
      el.style.left = `${p.edgeX}px`;
      el.style.top = `${p.edgeY}px`;
      el.style.transform = `rotate(${p.angleDeg}deg)`;
      el.style.opacity = String(p.opacity);
      el.style.color = p.isHolder ? HOLDER_COLOR : RUNNER_COLOR;
    }
  }

  private makeChevron(): HTMLDivElement {
    const chevron = document.createElement("div");
    chevron.textContent = "›";
    chevron.style.cssText =
      "position:absolute;left:0;top:0;width:28px;height:28px;margin:-14px 0 0 -14px;" +
      "display:flex;align-items:center;justify-content:center;" +
      "font-size:1.65rem;font-weight:800;line-height:1;" +
      "text-shadow:0 0 6px rgba(0,0,0,0.85),0 2px 8px rgba(0,0,0,0.55);" +
      "transform-origin:50% 50%;opacity:0;transition:opacity 0.06s linear;";
    this.root.appendChild(chevron);
    return chevron;
  }
}
