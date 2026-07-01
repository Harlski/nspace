/**
 * World Cup soccer - attacking-goal indicator (CLIENT-ONLY, FEATURE-FLAGGED, DEPRECATABLE).
 *
 * A single bobbing, slowly-spinning downward arrow that hovers above the goal the local
 * Match player is attacking, so they always know which net to shoot at. Cosmetic (no picking
 * or collision) and shown for Match participants only. To deprecate, delete this file and the
 * `worldcup`-tagged hooks in `Game.ts`.
 */
import * as THREE from "three";

export class WorldcupGoalArrow {
  readonly group = new THREE.Group();
  private readonly geo: THREE.ConeGeometry;
  private readonly mat: THREE.MeshStandardMaterial;
  private readonly baseY: number;
  private t = 0;

  constructor(x: number, z: number, baseY: number, colorHex: number) {
    this.baseY = baseY;
    // A short 4-sided cone, tip pointing straight down at the goal mouth.
    this.geo = new THREE.ConeGeometry(0.5, 1.0, 4);
    this.mat = new THREE.MeshStandardMaterial({
      color: colorHex,
      emissive: colorHex,
      emissiveIntensity: 0.65,
      roughness: 0.4,
      metalness: 0,
    });
    const cone = new THREE.Mesh(this.geo, this.mat);
    cone.rotation.x = Math.PI;
    cone.userData["skipBlockPickAndBounds"] = true;
    cone.raycast = () => {};
    this.group.add(cone);
    this.group.position.set(x, baseY, z);
  }

  /** Bob up/down and spin slowly. Returns true so the field keeps rendering while it exists. */
  update(dt: number): boolean {
    this.t += dt;
    this.group.position.y = this.baseY + Math.sin(this.t * 2.2) * 0.28;
    this.group.rotation.y += dt * 1.4;
    return true;
  }

  dispose(): void {
    this.geo.dispose();
    this.mat.dispose();
    this.group.clear();
  }
}
