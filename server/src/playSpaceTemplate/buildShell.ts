import type { RoomBackgroundNeutral } from "../roomRegistry.js";
import type { RoomBounds } from "../roomLayouts.js";
import type { TerrainProps } from "../grid.js";
import { blockKey } from "../grid.js";
import { sanitizeObstaclePropsForExport } from "../designSnapshot.js";
import {
  PLAY_SPACE_BACKGROUND_HUE_DEG,
  PLAY_SPACE_BLOCKS,
  PLAY_SPACE_BOUNDS,
  PLAY_SPACE_FLOOR_TINTS,
  PLAY_SPACE_SPAWN,
  type PlaySpaceBlockSpec,
} from "../directInvite/playSpaceLayout.js";

export const BUILD_SHELL_VERSION = 1 as const;

export type BuildShellObstacle = {
  tile: string;
  props: TerrainProps;
};

export type BuildShellFloorTint = { x: number; z: number; colorRgb: number };

export type BuildShell = {
  version: typeof BUILD_SHELL_VERSION;
  bounds: RoomBounds;
  obstacles: BuildShellObstacle[];
  extraFloor: BuildShellFloorTint[];
  baseFloorColors: BuildShellFloorTint[];
  removedBaseFloor: string[];
  backgroundHueDeg: number | null;
  backgroundNeutral: RoomBackgroundNeutral | null;
  joinSpawn: { x: number; z: number } | null;
};

export type LayoutSnapshotForBuildShell = {
  roomBounds: RoomBounds;
  obstacles: Array<{
    x: number;
    z: number;
    y: number;
    passable: boolean;
    half: boolean;
    quarter: boolean;
    hex: boolean;
    pyramid: boolean;
    pyramidBaseScale: number;
    hexRadiusScale: number;
    sphere: boolean;
    sphereRadiusScale: number;
    ramp: boolean;
    rampDir: number;
    cubeRotX: number;
    cubeRotY: number;
    cubeRotZ: number;
    colorRgb: number;
    locked?: boolean;
    teleporter?: TerrainProps["teleporter"];
    gate?: TerrainProps["gate"];
    claimable?: boolean;
    tutorialMineSlot?: boolean;
  }>;
  extraFloorTiles: Array<{ x: number; z: number; colorRgb?: number }>;
  baseFloorColorTiles: Array<{ x: number; z: number; colorRgb?: number }>;
  removedBaseFloorTiles: Array<{ x: number; z: number }>;
  roomBackgroundHueDeg: number | null;
  roomBackgroundNeutral: RoomBackgroundNeutral | null;
};

function specToTerrainProps(spec: PlaySpaceBlockSpec, locked: boolean): TerrainProps {
  return {
    passable: spec.passable,
    half: spec.half ?? false,
    quarter: spec.quarter ?? false,
    hex: spec.hex ?? false,
    pyramid: spec.pyramid ?? false,
    pyramidBaseScale: 1,
    hexRadiusScale: 1,
    sphere: spec.sphere ?? false,
    sphereRadiusScale: 1,
    ramp: spec.ramp ?? false,
    rampDir: Math.max(0, Math.min(3, Math.floor(spec.rampDir ?? 0))),
    colorRgb: spec.colorRgb,
    locked,
  };
}

/** Snapshot of the legacy hardcoded Play Space lounge (bootstrap default). */
export function buildShellFromLegacyPlaySpaceLayout(): BuildShell {
  const obstacles: BuildShellObstacle[] = PLAY_SPACE_BLOCKS.map((spec) => {
    const y = spec.y ?? 0;
    return {
      tile: blockKey(spec.x, spec.z, y),
      props: specToTerrainProps(spec, false),
    };
  });
  const baseFloorColors: BuildShellFloorTint[] = PLAY_SPACE_FLOOR_TINTS.map((t) => ({
    x: t.x,
    z: t.z,
    colorRgb: t.colorRgb,
  }));
  return {
    version: BUILD_SHELL_VERSION,
    bounds: { ...PLAY_SPACE_BOUNDS },
    obstacles,
    extraFloor: [],
    baseFloorColors,
    removedBaseFloor: [],
    backgroundHueDeg: PLAY_SPACE_BACKGROUND_HUE_DEG,
    backgroundNeutral: null,
    joinSpawn: { x: PLAY_SPACE_SPAWN.x, z: PLAY_SPACE_SPAWN.z },
  };
}

export function buildShellFromLayoutSnapshot(
  snap: LayoutSnapshotForBuildShell,
  joinSpawn: { x: number; z: number } | null
): BuildShell {
  const obstacles: BuildShellObstacle[] = [];
  for (const o of snap.obstacles) {
    const raw: TerrainProps = {
      passable: o.passable,
      half: o.half,
      quarter: o.quarter,
      hex: o.hex,
      pyramid: o.pyramid,
      pyramidBaseScale: o.pyramidBaseScale,
      hexRadiusScale: o.hexRadiusScale,
      sphere: o.sphere,
      sphereRadiusScale: o.sphereRadiusScale,
      ramp: o.ramp,
      rampDir: o.rampDir,
      cubeRotX: o.cubeRotX,
      cubeRotY: o.cubeRotY,
      cubeRotZ: o.cubeRotZ,
      colorRgb: o.colorRgb,
      locked: o.locked ?? false,
      teleporter: o.teleporter,
      gate: o.gate,
      claimable: o.claimable,
      tutorialMineSlot: o.tutorialMineSlot,
    };
    const props = sanitizeObstaclePropsForExport(raw);
    if (!props) continue;
    obstacles.push({
      tile: blockKey(o.x, o.z, o.y),
      props: { ...props, locked: false },
    });
  }
  return {
    version: BUILD_SHELL_VERSION,
    bounds: { ...snap.roomBounds },
    obstacles,
    extraFloor: snap.extraFloorTiles
      .filter((t) => typeof t.colorRgb === "number")
      .map((t) => ({
        x: t.x,
        z: t.z,
        colorRgb: t.colorRgb as number,
      })),
    baseFloorColors: snap.baseFloorColorTiles
      .filter((t) => typeof t.colorRgb === "number")
      .map((t) => ({
        x: t.x,
        z: t.z,
        colorRgb: t.colorRgb as number,
      })),
    removedBaseFloor: snap.removedBaseFloorTiles.map((t) => `${t.x},${t.z}`),
    backgroundHueDeg: snap.roomBackgroundHueDeg,
    backgroundNeutral: snap.roomBackgroundNeutral,
    joinSpawn,
  };
}

export type BuildShellRoomWriter = {
  clearGeometry: () => void;
  setObstacle: (tile: string, props: TerrainProps) => void;
  setExtraFloor: (x: number, z: number, colorRgb: number) => void;
  setBaseFloorColor: (x: number, z: number, colorRgb: number) => void;
  addRemovedBaseFloor: (tileKey: string) => void;
};

export function applyBuildShell(shell: BuildShell, writer: BuildShellRoomWriter): void {
  writer.clearGeometry();
  for (const o of shell.obstacles) {
    writer.setObstacle(o.tile, { ...o.props });
  }
  for (const t of shell.extraFloor) {
    writer.setExtraFloor(t.x, t.z, t.colorRgb);
  }
  for (const t of shell.baseFloorColors) {
    writer.setBaseFloorColor(t.x, t.z, t.colorRgb);
  }
  for (const key of shell.removedBaseFloor) {
    writer.addRemovedBaseFloor(key);
  }
}

/** Join spawn tile must not be blocked by a non-passable floor obstacle. */
export function joinSpawnIsPassable(shell: BuildShell): boolean {
  if (!shell.joinSpawn) return true;
  const { x, z } = shell.joinSpawn;
  for (const o of shell.obstacles) {
    const parts = o.tile.split(",").map(Number);
    const ox = parts[0]!;
    const oz = parts[1]!;
    const oy = Number.isFinite(parts[2]) ? parts[2]! : 0;
    if (ox === x && oz === z && oy === 0 && !o.props.passable) return false;
  }
  return true;
}
