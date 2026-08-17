import * as THREE from "three";
import { waypointWorldY, type TerrainProps } from "./grid.js";

export const MOVEMENT_WATCH_MARKER_LINGER_MS = 5000;
const PATH_Y = 0.07;
const ACCEPT_COLOR = 0x38bdf8;
const REJECT_COLOR = 0xf87171;
const INTERVAL_LABEL_LIFT = 0.36;
/** World height of the Click Interval plate; width follows the number. */
const INTERVAL_LABEL_WORLD_H = 0.16;

/** Frozen Click Interval label: hundredths of a second, no unit. */
export function formatClickIntervalSec(sec: number): string {
  return sec.toFixed(2);
}

export type MovementWatchWaypoint = { x: number; z: number; layer: 0 | 1 };

export type MovementWatchClickEvent = {
  address: string;
  displayName: string;
  x: number;
  z: number;
  layer: 0 | 1;
  accepted: boolean;
  showMarker: boolean;
  reason?: string;
  path?: MovementWatchWaypoint[];
  startX?: number;
  startZ?: number;
  /** Seconds since this player's previous shown Click Marker; omitted on the first. */
  clickIntervalSec?: number;
};

export type MovementWatchWalkEvent = {
  address: string;
  displayName: string;
  goalX: number;
  goalZ: number;
  goalLayer: 0 | 1;
  path: MovementWatchWaypoint[];
  startX: number;
  startZ: number;
};

type MarkerEntry = {
  mesh: THREE.Mesh;
  label: THREE.Sprite;
  intervalLabel: THREE.Sprite | null;
  expiresAtMs: number;
  reason?: string;
};

type PathEntry = {
  line: THREE.Line;
};

function truncateLabel(name: string, max = 14): string {
  const t = name.trim() || "?";
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

function makeLabelSprite(text: string, color: string): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = '600 22px system-ui, "Segoe UI", sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fillRect(8, 8, canvas.width - 16, canvas.height - 16);
  ctx.fillStyle = color;
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthTest: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(1.8, 0.45, 1);
  sprite.renderOrder = 10;
  return sprite;
}

/** Click Interval plate: glyphs fill the box; box width follows the number. */
function makeIntervalLabelSprite(text: string, color: string): THREE.Sprite {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  const fontPx = 72;
  const font = `700 ${fontPx}px system-ui, "Segoe UI", sans-serif`;
  ctx.font = font;
  const metrics = ctx.measureText(text);
  const ascent = metrics.actualBoundingBoxAscent || fontPx * 0.8;
  const descent = metrics.actualBoundingBoxDescent || fontPx * 0.2;
  const glyphH = Math.max(1, ascent + descent);
  const padX = Math.ceil(fontPx * 0.1);
  const padY = Math.max(1, Math.ceil(fontPx * 0.04));
  const w = Math.max(1, Math.ceil(metrics.width + padX * 2));
  const h = Math.max(1, Math.ceil(glyphH + padY * 2));
  canvas.width = w;
  canvas.height = h;
  ctx.font = font;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = color;
  ctx.fillText(text, w / 2, padY + ascent);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthTest: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(INTERVAL_LABEL_WORLD_H * (w / h), INTERVAL_LABEL_WORLD_H, 1);
  sprite.renderOrder = 11;
  return sprite;
}

function disposeObject3D(obj: THREE.Object3D): void {
  obj.traverse((o: THREE.Object3D) => {
    const mesh = o as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const mat = (mesh as THREE.Mesh).material;
    if (mat) {
      const mats = Array.isArray(mat) ? mat : [mat];
      for (const m of mats) {
        const sm = m as THREE.SpriteMaterial;
        if (sm.map) sm.map.dispose();
        m.dispose();
      }
    }
  });
}

/**
 * Admin-only Movement Watch drawing: Click Markers + Watch Paths.
 * Attaches into the game scene; callers own enable/disable and WS routing.
 */
export class MovementWatchView {
  private readonly root = new THREE.Group();
  private readonly markers = new Map<string, MarkerEntry[]>();
  private readonly paths = new Map<string, PathEntry>();
  private enabled = false;
  private markerSeq = 0;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly getPlaced: () => ReadonlyMap<string, TerrainProps>
  ) {
    this.root.name = "movementWatch";
    this.root.visible = false;
    this.scene.add(this.root);
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    this.root.visible = on;
    if (!on) this.clearAll();
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  applySnapshot(walks: MovementWatchWalkEvent[]): void {
    if (!this.enabled) return;
    for (const addr of [...this.paths.keys()]) {
      this.clearPath(addr);
    }
    for (const w of walks) {
      this.setPath(w.address, w.startX, w.startZ, w.path);
      this.addMarker({
        address: w.address,
        displayName: w.displayName,
        x: w.goalX,
        z: w.goalZ,
        layer: w.goalLayer,
        accepted: true,
        reason: undefined,
      });
    }
  }

  applyClick(ev: MovementWatchClickEvent): void {
    if (!this.enabled) return;
    if (ev.accepted) {
      const path = ev.path ?? [];
      const sx = ev.startX ?? ev.x;
      const sz = ev.startZ ?? ev.z;
      this.setPath(ev.address, sx, sz, path);
    }
    if (ev.showMarker) {
      this.addMarker({
        address: ev.address,
        displayName: ev.displayName,
        x: ev.x,
        z: ev.z,
        layer: ev.layer,
        accepted: ev.accepted,
        reason: ev.reason,
        clickIntervalSec: ev.clickIntervalSec,
      });
    }
  }

  clearAddress(address: string): void {
    this.clearPath(address);
  }

  /** Expire Click Markers; call from the game frame loop. */
  update(nowMs: number = performance.now()): void {
    if (!this.enabled) return;
    for (const [addr, list] of this.markers) {
      const keep: MarkerEntry[] = [];
      for (const m of list) {
        if (m.expiresAtMs > nowMs) {
          keep.push(m);
        } else {
          this.disposeMarker(m);
        }
      }
      if (keep.length === 0) this.markers.delete(addr);
      else this.markers.set(addr, keep);
    }
  }

  clearAll(): void {
    for (const addr of [...this.paths.keys()]) this.clearPath(addr);
    for (const [addr, list] of this.markers) {
      for (const m of list) {
        this.disposeMarker(m);
      }
      this.markers.delete(addr);
    }
  }

  dispose(): void {
    this.clearAll();
    this.scene.remove(this.root);
  }

  private disposeMarker(m: MarkerEntry): void {
    this.root.remove(m.mesh);
    this.root.remove(m.label);
    disposeObject3D(m.mesh);
    disposeObject3D(m.label);
    if (m.intervalLabel) {
      this.root.remove(m.intervalLabel);
      disposeObject3D(m.intervalLabel);
    }
  }

  private addMarker(args: {
    address: string;
    displayName: string;
    x: number;
    z: number;
    layer: 0 | 1;
    accepted: boolean;
    reason?: string;
    clickIntervalSec?: number;
  }): void {
    const placed = this.getPlaced();
    const y = waypointWorldY(args.layer, args.x, args.z, placed) + 0.04;
    const color = args.accepted ? ACCEPT_COLOR : REJECT_COLOR;
    const geom = new THREE.PlaneGeometry(0.85, 0.85);
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: args.accepted ? 0.55 : 0.7,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(args.x, y, args.z);
    mesh.name = `mw-marker-${++this.markerSeq}`;

    const labelColor = args.accepted ? "#e0f2fe" : "#fecaca";
    const labelText = args.accepted
      ? truncateLabel(args.displayName)
      : `${truncateLabel(args.displayName)} · ${args.reason ?? "reject"}`;
    const label = makeLabelSprite(labelText, labelColor);
    label.position.set(args.x, y + 0.55, args.z);

    let intervalLabel: THREE.Sprite | null = null;
    if (
      typeof args.clickIntervalSec === "number" &&
      Number.isFinite(args.clickIntervalSec)
    ) {
      intervalLabel = makeIntervalLabelSprite(
        formatClickIntervalSec(args.clickIntervalSec),
        labelColor
      );
      intervalLabel.position.set(args.x, y + 0.55 + INTERVAL_LABEL_LIFT, args.z);
    }

    this.root.add(mesh);
    this.root.add(label);
    if (intervalLabel) this.root.add(intervalLabel);
    const list = this.markers.get(args.address) ?? [];
    list.push({
      mesh,
      label,
      intervalLabel,
      expiresAtMs: performance.now() + MOVEMENT_WATCH_MARKER_LINGER_MS,
      reason: args.reason,
    });
    this.markers.set(args.address, list);
  }

  private setPath(
    address: string,
    startX: number,
    startZ: number,
    path: MovementWatchWaypoint[]
  ): void {
    this.clearPath(address);
    if (path.length === 0) return;
    const placed = this.getPlaced();
    const points: number[] = [];
    const startLayer = path[0]?.layer ?? 0;
    points.push(
      startX,
      waypointWorldY(startLayer, startX, startZ, placed) + PATH_Y,
      startZ
    );
    for (const w of path) {
      points.push(
        w.x,
        waypointWorldY(w.layer, w.x, w.z, placed) + PATH_Y,
        w.z
      );
    }
    if (points.length < 6) return;
    const geom = new THREE.BufferGeometry();
    geom.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(points, 3)
    );
    const mat = new THREE.LineBasicMaterial({
      color: ACCEPT_COLOR,
      transparent: true,
      opacity: 0.9,
      depthTest: true,
    });
    const line = new THREE.Line(geom, mat);
    line.frustumCulled = false;
    this.root.add(line);
    this.paths.set(address, { line });
  }

  private clearPath(address: string): void {
    const entry = this.paths.get(address);
    if (!entry) return;
    this.root.remove(entry.line);
    disposeObject3D(entry.line);
    this.paths.delete(address);
  }
}
