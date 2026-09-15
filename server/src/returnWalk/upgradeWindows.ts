/**
 * Server-owned Upgrade Windows. Resident does not POST Upgrade or send coordinates.
 */

import { UPGRADE_WINDOW_MS, UPGRADES_PER_WINDOW } from "./constants.js";
import { pickUpgradeTiles } from "./tiles.js";
import {
  hasOpenReturnWalkBudget,
  releaseReturnGoldReservation,
  reserveReturnGold,
} from "./store.js";
import {
  getReturnWalkWorld,
  type ReturnWalkEligibleTile,
} from "./world.js";

export type UpgradeWindowScheduler = {
  now: () => number;
  setTimeout: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clearTimeout: (id: ReturnType<typeof setTimeout>) => void;
  random: () => number;
};

const defaultScheduler: UpgradeWindowScheduler = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (id) => clearTimeout(id),
  random: () => Math.random(),
};

let scheduler: UpgradeWindowScheduler = defaultScheduler;

const pending = new Set<ReturnType<typeof setTimeout>>();

export function setUpgradeWindowSchedulerForTests(
  next: UpgradeWindowScheduler | null
): void {
  scheduler = next ?? defaultScheduler;
}

export function cancelPendingUpgradeWindows(): void {
  for (const id of pending) scheduler.clearTimeout(id);
  pending.clear();
}

function delayMs(): number {
  return Math.floor(scheduler.random() * (UPGRADE_WINDOW_MS + 1));
}

function fireOneUpgrade(used: Set<string>): void {
  const world = getReturnWalkWorld();
  if (!world) return;
  if (!hasOpenReturnWalkBudget()) return;
  const pose = world.getResidentPose();
  if (!pose) return;
  const eligible = world
    .listEligibleUpgradeTiles(pose.roomId, pose.x, pose.z)
    .filter((t) => !used.has(`${t.x},${t.z}`));
  const picked = pickUpgradeTiles(eligible, 1, scheduler.random);
  const tile = picked[0] as ReturnWalkEligibleTile | undefined;
  if (!tile) return;
  const tileKey = `${tile.x},${tile.z}`;
  if (
    !reserveReturnGold({
      roomId: pose.roomId,
      tileKey,
    })
  ) {
    return;
  }
  const ok = world.convertTileToReturnGold(pose.roomId, tile.x, tile.z);
  if (!ok) {
    releaseReturnGoldReservation({ roomId: pose.roomId, tileKey });
    return;
  }
  used.add(tileKey);
}

/**
 * Start an Upgrade Window: 5 seconds, two Upgrades at random delays in [0, 5000] ms.
 * Windows stack. Uses Resident's pose at fire time, not claim time.
 */
export function startUpgradeWindow(): void {
  const used = new Set<string>();
  for (let i = 0; i < UPGRADES_PER_WINDOW; i++) {
    const wait = delayMs();
    const id = scheduler.setTimeout(() => {
      pending.delete(id);
      fireOneUpgrade(used);
    }, wait);
    pending.add(id);
  }
}

export function pendingUpgradeWindowCountForTests(): number {
  return pending.size;
}
