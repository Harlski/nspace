/**
 * World Cup soccer - pure ground-only 2D ball physics (no I/O, unit-tested).
 *
 * World units == tiles. Tile centers sit at integer indices; a tile spans
 * [c-0.5, c+0.5]. Room walls therefore sit at `bounds.min-0.5` and `bounds.max+0.5`.
 * Keeping these functions pure makes them trivial to test and reuse across the field
 * ball and player-placed balls.
 */
import type { RoomBounds } from "../roomLayouts.js";
import type { GoalZone } from "./config.js";

export interface BallSim {
  x: number;
  z: number;
  vx: number;
  vz: number;
}

export interface BallPhysicsConfig {
  radius: number;
  maxSpeed: number;
  /** Linear rolling deceleration (units/sec^2). */
  decel: number;
  /** Below this speed the ball is treated as stopped. */
  minSpeed: number;
  /** Wall/obstacle bounce energy retention (0..1). */
  restitution: number;
}

export interface KickConfig {
  reach: number;
  baseSpeed: number;
  playerSpeedScale: number;
  cooldownMs: number;
}

/** Optional solid-tile predicate for obstacle bounce (M3); omitted on the open field. */
export type SolidTilePredicate = (tileX: number, tileZ: number) => boolean;

/** A circular obstacle the ball reflects off (blocker-mode Goalie). */
export interface CircleCollider {
  x: number;
  z: number;
  radius: number;
}

function tileIndex(worldCoord: number): number {
  return Math.round(worldCoord);
}

/**
 * True if `z` lies within a goal's mouth on the given side, inset by the ball radius so the
 * whole ball clears the posts before the end-line wall opens for it.
 */
function goalMouthOpenZ(
  goals: readonly GoalZone[],
  side: "west" | "east",
  z: number,
  r: number
): boolean {
  for (const g of goals) {
    if (g.id !== side) continue;
    if (z >= g.minZ - 0.5 + r && z <= g.maxZ + 0.5 - r) return true;
  }
  return false;
}

/** Post z-bounds (mouth edges) for a side, or null if there is no goal there. */
function goalPostZ(
  goals: readonly GoalZone[],
  side: "west" | "east"
): { zMin: number; zMax: number } | null {
  for (const g of goals) {
    if (g.id === side) return { zMin: g.minZ - 0.5, zMax: g.maxZ + 0.5 };
  }
  return null;
}

/** Clamp a velocity vector to a maximum speed, preserving direction. */
export function clampSpeed(
  vx: number,
  vz: number,
  maxSpeed: number
): { vx: number; vz: number } {
  const speed = Math.hypot(vx, vz);
  if (speed <= maxSpeed || speed === 0) return { vx, vz };
  const k = maxSpeed / speed;
  return { vx: vx * k, vz: vz * k };
}

/**
 * Advance the ball one step. Returns a NEW BallSim (does not mutate the input).
 * Applies rolling friction, max-speed clamp, wall reflection, optional solid-tile
 * reflection, and optional circular-obstacle reflection (blocker-mode Goalie via
 * `colliders`). Integrates per-axis so tile collisions resolve cleanly; circle
 * colliders are resolved last, against the post-move position.
 */
export function stepBall(
  ball: BallSim,
  dt: number,
  bounds: RoomBounds,
  cfg: BallPhysicsConfig,
  isSolidTile?: SolidTilePredicate,
  goals?: readonly GoalZone[],
  goalDepth = 0,
  colliders?: readonly CircleCollider[]
): BallSim {
  let { x, z, vx, vz } = ball;

  // Rolling friction.
  const speed = Math.hypot(vx, vz);
  if (speed <= cfg.minSpeed) {
    return { x, z, vx: 0, vz: 0 };
  }
  const nextSpeed = Math.max(0, speed - cfg.decel * dt);
  if (nextSpeed <= cfg.minSpeed) {
    // Still let it coast a final tiny step, then stop.
    vx = 0;
    vz = 0;
  } else {
    const scale = nextSpeed / speed;
    vx *= scale;
    vz *= scale;
  }

  const clamped = clampSpeed(vx, vz, cfg.maxSpeed);
  vx = clamped.vx;
  vz = clamped.vz;

  const r = cfg.radius;
  const minXWall = bounds.minX - 0.5;
  const maxXWall = bounds.maxX + 0.5;
  const minZWall = bounds.minZ - 0.5;
  const maxZWall = bounds.maxZ + 0.5;
  const hasGoals = !!goals && goals.length > 0;

  // X axis.
  let nx = x + vx * dt;
  if (nx - r < minXWall) {
    // West end line: open at the goal mouth (ball passes into the net box, bounded at the
    // net); solid everywhere else along the line.
    if (hasGoals && goalMouthOpenZ(goals, "west", z, r)) {
      const backWall = minXWall - goalDepth;
      if (nx - r < backWall) {
        nx = backWall + r;
        vx = -vx * cfg.restitution;
      }
    } else {
      nx = minXWall + r;
      vx = -vx * cfg.restitution;
    }
  } else if (nx + r > maxXWall) {
    if (hasGoals && goalMouthOpenZ(goals, "east", z, r)) {
      const backWall = maxXWall + goalDepth;
      if (nx + r > backWall) {
        nx = backWall - r;
        vx = -vx * cfg.restitution;
      }
    } else {
      nx = maxXWall - r;
      vx = -vx * cfg.restitution;
    }
  } else if (isSolidTile && isSolidTile(tileIndex(nx), tileIndex(z))) {
    nx = x;
    vx = -vx * cfg.restitution;
  }
  x = nx;

  // Z axis (using the updated x). Inside a net box (behind a goal line) the posts bound z;
  // on the pitch the room walls do.
  const post = hasGoals
    ? x < minXWall
      ? goalPostZ(goals, "west")
      : x > maxXWall
        ? goalPostZ(goals, "east")
        : null
    : null;
  let nz = z + vz * dt;
  if (post) {
    if (nz - r < post.zMin) {
      nz = post.zMin + r;
      vz = -vz * cfg.restitution;
    } else if (nz + r > post.zMax) {
      nz = post.zMax - r;
      vz = -vz * cfg.restitution;
    }
  } else if (nz - r < minZWall) {
    nz = minZWall + r;
    vz = -vz * cfg.restitution;
  } else if (nz + r > maxZWall) {
    nz = maxZWall - r;
    vz = -vz * cfg.restitution;
  } else if (isSolidTile && isSolidTile(tileIndex(x), tileIndex(nz))) {
    nz = z;
    vz = -vz * cfg.restitution;
  }
  z = nz;

  // Circular obstacles (blocker-mode Goalie): reflect the ball off the contact normal.
  if (colliders && colliders.length > 0) {
    for (const c of colliders) {
      const minDist = r + c.radius;
      const dx = x - c.x;
      const dz = z - c.z;
      const dist = Math.hypot(dx, dz);
      if (dist >= minDist) continue;
      if (dist > 1e-9) {
        const nxn = dx / dist;
        const nzn = dz / dist;
        x = c.x + nxn * minDist;
        z = c.z + nzn * minDist;
        const vn = vx * nxn + vz * nzn;
        if (vn < 0) {
          vx -= (1 + cfg.restitution) * vn * nxn;
          vz -= (1 + cfg.restitution) * vn * nzn;
        }
      } else {
        // Degenerate overlap at the centre: shove straight out along x.
        x = c.x + minDist;
        vx = Math.abs(vx) * cfg.restitution;
      }
    }
  }

  return { x, z, vx, vz };
}

/** Set the ball's velocity along a direction at a given speed (clamped, normalized). */
export function applyKick(
  ball: BallSim,
  dirX: number,
  dirZ: number,
  speed: number,
  cfg: BallPhysicsConfig
): BallSim {
  const len = Math.hypot(dirX, dirZ);
  if (len === 0) return { ...ball };
  const s = Math.min(speed, cfg.maxSpeed);
  return { x: ball.x, z: ball.z, vx: (dirX / len) * s, vz: (dirZ / len) * s };
}

/** True when a player center is close enough to the ball to kick it. */
export function canKick(
  px: number,
  pz: number,
  bx: number,
  bz: number,
  radius: number,
  reach: number
): boolean {
  return Math.hypot(px - bx, pz - bz) <= radius + reach;
}

/**
 * Derive kick direction + speed from a player's motion. If the player is moving, kick
 * along their travel heading (you aim by approaching from the right side); if nearly
 * stationary, kick directly away from the player. Speed = base + scale * playerSpeed.
 */
export function kickFromPlayer(
  args: { px: number; pz: number; vx: number; vz: number; bx: number; bz: number },
  kickCfg: KickConfig,
  maxSpeed: number
): { dirX: number; dirZ: number; speed: number } {
  const playerSpeed = Math.hypot(args.vx, args.vz);
  let dirX: number;
  let dirZ: number;
  if (playerSpeed > 0.05) {
    dirX = args.vx;
    dirZ = args.vz;
  } else {
    dirX = args.bx - args.px;
    dirZ = args.bz - args.pz;
    if (Math.hypot(dirX, dirZ) === 0) {
      dirX = 1;
      dirZ = 0;
    }
  }
  const len = Math.hypot(dirX, dirZ) || 1;
  const speed = Math.min(
    maxSpeed,
    kickCfg.baseSpeed + kickCfg.playerSpeedScale * playerSpeed
  );
  return { dirX: dirX / len, dirZ: dirZ / len, speed };
}

/**
 * Return the id of the goal the ball has scored in, else null. The ball must have crossed
 * the goal LINE (the pitch end) within the mouth - being merely in front of the goal does
 * not count. The end-line wall opening (see `stepBall`) is what lets the ball get there.
 */
export function detectGoal(
  ball: { x: number; z: number },
  goals: readonly GoalZone[]
): GoalZone["id"] | null {
  for (const g of goals) {
    if (ball.z < g.minZ - 0.5 || ball.z > g.maxZ + 0.5) continue;
    if (g.id === "west" && ball.x <= g.minX - 0.5) return g.id;
    if (g.id === "east" && ball.x >= g.maxX + 0.5) return g.id;
  }
  return null;
}
