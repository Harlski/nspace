import type { BuildShell, BuildShellObstacle } from "../playSpaceTemplate/buildShell.js";
import { BUILD_SHELL_VERSION } from "../playSpaceTemplate/buildShell.js";
import { blockKey } from "../grid.js";
import type { TerrainProps } from "../grid.js";
import { TELEPORTER_DEFAULT_PILLAR_COLOR_RGB } from "../blockColors.js";
import {
  CHAMBER_DEFAULT_SPAWN,
  CHAMBER_ROOM_ID,
} from "../roomLayouts.js";
import { TUTORIAL_ROOM_ID, TUTORIAL_STAGING_ROOM_ID } from "../tutorial/roomIds.js";

/** Stable Unlock Pad instance id for the default Tutorial Path Pay band. */
export const TUTORIAL_PATH_UNLOCK_PAD_INSTANCE_ID =
  "tutorial-path-unlock-pad-v1" as const;
export const TUTORIAL_DEFAULT_BOUNDS = {
  minX: -3,
  maxX: 3,
  minZ: -7,
  maxZ: 7,
} as const;

/**
 * Alcove Garden Tutorial Path palette (solid in-game block / floor colors).
 * Matches the preferred concept mockup in `.scratch/tutorial-path-directions/`.
 */
const COLOR = {
  grass: 0x2f6b3a,
  path: 0x9ca3af,
  padBand: 0x86efac,
  northGlow: 0xfff3c4,
  hedge: 0x1b4332,
  hedgeAccentPurple: 0x7c3aed,
  hedgeAccentCyan: 0x22d3ee,
  mine: 0xf59e0b,
  pad: 0x22c55e,
  trunk: 0x795548,
  canopy: 0x3d8b4a,
  canopyTop: 0x4caf50,
} as const;

/** Geometric mid of Z -7..7 — Unlock Pad (Pay). Exit Teleporter is one step north. */
const GATE_Z = 0;
const EXIT_TELEPORTER_Z = GATE_Z + 1;
const JOIN_SPAWN = { x: 0, z: -6 } as const;
const MINE_Z = -5;

/** Side hedge accent columns (z → color). Default hedge green otherwise. */
const HEDGE_ACCENTS_WEST: ReadonlyMap<number, number> = new Map([
  [-6, COLOR.hedgeAccentPurple],
  [-3, COLOR.hedgeAccentCyan],
  [1, COLOR.hedgeAccentPurple],
  [4, COLOR.hedgeAccentPurple],
]);
const HEDGE_ACCENTS_EAST: ReadonlyMap<number, number> = new Map([
  [-6, COLOR.hedgeAccentPurple],
  [-2, COLOR.hedgeAccentCyan],
  [3, COLOR.hedgeAccentCyan],
]);

/** Inner-border pine spots (x=±2). Never on mine row so side lanes stay walkable. */
const TREE_SPOTS: ReadonlyArray<{ x: number; z: number }> = [
  { x: -2, z: -3 },
  { x: -2, z: 2 },
  { x: -2, z: 5 },
  { x: 2, z: -4 },
  { x: 2, z: 1 },
  { x: 2, z: 4 },
];

function baseProps(overrides: Partial<TerrainProps> & Pick<TerrainProps, "colorRgb">): TerrainProps {
  return {
    passable: false,
    half: false,
    quarter: false,
    hex: false,
    pyramid: false,
    pyramidBaseScale: 1,
    hexRadiusScale: 1,
    sphere: false,
    sphereRadiusScale: 1,
    ramp: false,
    rampDir: 0,
    cubeRotX: 0,
    cubeRotY: 0,
    cubeRotZ: 0,
    locked: false,
    ...overrides,
  };
}

function obstacle(x: number, z: number, y: number, props: TerrainProps): BuildShellObstacle {
  return { tile: blockKey(x, z, y), props };
}

function pushPine(
  out: BuildShellObstacle[],
  x: number,
  z: number
): void {
  out.push(obstacle(x, z, 0, baseProps({ colorRgb: COLOR.trunk })));
  out.push(
    obstacle(
      x,
      z,
      1,
      baseProps({ colorRgb: COLOR.canopy, pyramid: true, pyramidBaseScale: 1 })
    )
  );
  out.push(
    obstacle(
      x,
      z,
      2,
      baseProps({ colorRgb: COLOR.canopyTop, pyramid: true, pyramidBaseScale: 0.72 })
    )
  );
}

function buildTutorialPathObstacles(): BuildShellObstacle[] {
  const out: BuildShellObstacle[] = [];
  const { minX, maxX, minZ, maxZ } = TUTORIAL_DEFAULT_BOUNDS;

  // East / west hedge (single-cube rim) with sparse purple/cyan accents.
  for (let z = minZ; z <= maxZ; z++) {
    const west =
      HEDGE_ACCENTS_WEST.get(z) ?? COLOR.hedge;
    const east =
      HEDGE_ACCENTS_EAST.get(z) ?? COLOR.hedge;
    out.push(obstacle(minX, z, 0, baseProps({ colorRgb: west })));
    out.push(obstacle(maxX, z, 0, baseProps({ colorRgb: east })));
  }

  // Closed south wall behind spawn (same hedge language).
  for (let x = minX + 1; x <= maxX - 1; x++) {
    out.push(obstacle(x, minZ, 0, baseProps({ colorRgb: COLOR.hedge })));
  }

  // Three Tutorial Mine Slots just north of spawn (south band).
  for (const x of [-1, 0, 1] as const) {
    out.push(
      obstacle(
        x,
        MINE_Z,
        0,
        baseProps({
          colorRgb: COLOR.mine,
          pyramid: true,
          tutorialMineSlot: true,
          claimable: true,
          active: true,
        })
      )
    );
  }

  // Side pines on the grass border (inner columns x=±2).
  for (const spot of TREE_SPOTS) {
    pushPine(out, spot.x, spot.z);
  }

  // Pay band: Unlock Pad (crossing after Unlock Pad Grant).
  out.push(
    obstacle(
      0,
      GATE_Z,
      0,
      baseProps({
        colorRgb: COLOR.pad,
        unlockPad: {
          amountLuna: "1000000",
          recipient: "SYSTEM",
          buttonLabel: "Unlock Pad",
          proofMode: "optimistic",
          instanceId: TUTORIAL_PATH_UNLOCK_PAD_INSTANCE_ID,
        },
      })
    )
  );

  // Exit band: authored Exit Teleporter → Hub (lesson complete on Enter).
  out.push(
    obstacle(
      0,
      EXIT_TELEPORTER_Z,
      0,
      baseProps({
        passable: true,
        quarter: true,
        hex: true,
        locked: true,
        colorRgb: TELEPORTER_DEFAULT_PILLAR_COLOR_RGB,
        teleporter: {
          targetRoomId: CHAMBER_ROOM_ID,
          targetX: CHAMBER_DEFAULT_SPAWN.x,
          targetZ: CHAMBER_DEFAULT_SPAWN.z,
        },
      })
    )
  );

  return out;
}

function buildGrassBaseFloor(): BuildShell["baseFloorColors"] {
  const tiles: BuildShell["baseFloorColors"] = [];
  const { minX, maxX, minZ, maxZ } = TUTORIAL_DEFAULT_BOUNDS;
  for (let z = minZ; z <= maxZ; z++) {
    for (let x = minX; x <= maxX; x++) {
      tiles.push({ x, z, colorRgb: COLOR.grass });
    }
  }
  return tiles;
}

function buildPathFloor(): BuildShell["extraFloor"] {
  const tiles: BuildShell["extraFloor"] = [];
  const { minZ, maxZ } = TUTORIAL_DEFAULT_BOUNDS;

  for (let z = minZ; z <= maxZ; z++) {
    for (let x = -1; x <= 1; x++) {
      let colorRgb: number = COLOR.path;
      // Pad clearing (light green) around Unlock Pad.
      if (z >= GATE_Z - 1 && z <= GATE_Z + 1) {
        colorRgb = COLOR.padBand;
      }
      // Soft north glow (visual pull toward Exit Teleporter).
      if (z >= maxZ - 2) {
        colorRgb = COLOR.northGlow;
      }
      // Spawn / mine approach stay on stone path (not pad band).
      if (z <= MINE_Z) {
        colorRgb = COLOR.path;
      }
      tiles.push({ x, z, colorRgb });
    }
  }
  return tiles;
}

export function buildDefaultTutorialBootstrapShell(): BuildShell {
  return {
    version: BUILD_SHELL_VERSION,
    bounds: { ...TUTORIAL_DEFAULT_BOUNDS },
    obstacles: buildTutorialPathObstacles(),
    extraFloor: buildPathFloor(),
    baseFloorColors: buildGrassBaseFloor(),
    removedBaseFloor: [],
    backgroundHueDeg: 165,
    backgroundNeutral: null,
    joinSpawn: { ...JOIN_SPAWN },
  };
}

export function isValidTutorialTemplateSourceRoom(roomId: string): boolean {
  const id = roomId.trim().toLowerCase();
  return id === TUTORIAL_STAGING_ROOM_ID;
}

export function isTutorialTemplateRuntimeRoom(roomId: string): boolean {
  const id = roomId.trim().toLowerCase();
  return id === TUTORIAL_ROOM_ID || id === TUTORIAL_STAGING_ROOM_ID;
}
